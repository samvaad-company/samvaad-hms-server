/**
 * The WhatsApp chat assistant: what a patient's message to the hospital's number gets back.
 *
 * Meta posts every inbound message and delivery report to the webhook; the route acknowledges at once and hands the payload here.
 * Each message is matched to its hospital by the receiving number, then routed in a fixed order:
 *   1. "cancel / stop / reset" ends whatever the patient was in the middle of;
 *   2. an emergency phrase gets a fixed safety reply (never a diagnosis);
 *   3. a conversation already under way carries on (booking an appointment);
 *   4. a greeting or a clear request starts one — book, upcoming appointments, prescriptions;
 *   5. anything else goes to the AI, which answers briefly as the hospital and sends unknowns to a human.
 * Conversation state is kept in memory per patient number, so with more than one server instance it should move to Redis.
 */
import { appointmentsRepo, doctorsRepo, hospitalsRepo, patientsRepo, prescriptionsRepo } from "@/repositories";
import type { AppointmentRow, DoctorRow, PatientRow, PrescriptionRow } from "@/db/tables";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { localDate, parseClock, to12h } from "@/lib/clock";
import { streamGenerateContent, isGeminiLive } from "@/services/gemini";
import { bookInPerson } from "@/services/appointment-scheduling-service";
import { loadDoctor, slotsFor } from "@/services/scheduling-service";
import { accountByPhoneNumberId, applyStatus, logMessage, outboundOf, reply, type Outbound } from "@/services/whatsapp-service";

// ── What Meta posts ──────────────────────────────────────────────────────────

interface InboundMessage { id: string; from: string; text: string; buttonId: string; type: string; phoneNumberId: string; name: string }

/** The patient's words, from a typed message, a tapped button or a picked list row. */
function textOf(msg: Record<string, any>): { text: string; buttonId: string } {
  if (msg.type === "text") return { text: String(msg.text?.body ?? ""), buttonId: "" };
  if (msg.type === "button") return { text: String(msg.button?.text ?? ""), buttonId: String(msg.button?.payload ?? "") };
  if (msg.type === "interactive") {
    const r = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
    return { text: String(r?.title ?? ""), buttonId: String(r?.id ?? "") };
  }
  return { text: "", buttonId: "" };
}

export function parseWebhook(body: any): { messages: InboundMessage[]; statuses: any[] } {
  const messages: InboundMessage[] = [];
  const statuses: any[] = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? "");
      const names = new Map<string, string>((value.contacts ?? []).map((c: any) => [String(c.wa_id), String(c.profile?.name ?? "")]));
      for (const m of Array.isArray(value.messages) ? value.messages : []) {
        const { text, buttonId } = textOf(m);
        messages.push({ id: String(m.id ?? ""), from: String(m.from ?? ""), text, buttonId, type: String(m.type ?? ""), phoneNumberId, name: names.get(String(m.from)) ?? "" });
      }
      statuses.push(...(Array.isArray(value.statuses) ? value.statuses : []));
    }
  }
  return { messages, statuses };
}

/** Meta can deliver a message twice; remember ids for ten minutes. */
const seen = new Map<string, number>();
function isDuplicate(id: string): boolean {
  const now = Date.now();
  for (const [k, t] of seen) if (now - t > 600_000) seen.delete(k);
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.set(id, now);
  return false;
}

export async function processWebhook(body: unknown): Promise<void> {
  const { messages, statuses } = parseWebhook(body);
  for (const s of statuses) await applyStatus(s).catch((e) => logger.warn("whatsapp.status_failed", { error: String(e) }));
  for (const m of messages) {
    if (isDuplicate(m.id)) continue;
    try { await handleInbound(m); } catch (e) { logger.error("whatsapp.bot_failed", { error: e instanceof Error ? e.message : String(e) }); }
  }
}

// ── Conversation state ───────────────────────────────────────────────────────

type Step = "name" | "age" | "doctor" | "date" | "slot" | "reason" | "confirm";
interface Booking { step: Step; patientId: number | null; name: string; age: number; doctors: { id: number; name: string }[]; doctorId?: number; doctorName?: string; date?: string; slots: { value: string; label: string }[]; time?: string; reason?: string }
interface Ctx { booking: Booking | null; history: { role: "user" | "model"; text: string }[]; touched: number }

const contexts = new Map<string, Ctx>();
function ctxOf(hospitalId: number, phone: string): Ctx {
  const now = Date.now();
  for (const [k, c] of contexts) if (now - c.touched > 4 * 86_400_000) contexts.delete(k);
  const key = `${hospitalId}:${phone}`;
  const c = contexts.get(key) ?? { booking: null, history: [], touched: now };
  c.touched = now;
  contexts.set(key, c);
  return c;
}

interface Reply { text: string; buttons?: { id: string; title: string }[] }

// ── Who is writing ───────────────────────────────────────────────────────────

const last10 = (v: string) => v.replace(/\D/g, "").slice(-10);

async function patientByPhone(hospitalId: number, phone: string): Promise<PatientRow | null> {
  const { rows } = await patientsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never);
  const want = last10(phone);
  return (rows as PatientRow[]).find((p) => last10(String(p.phone ?? "")) === want) ?? null;
}

// ── Intents ──────────────────────────────────────────────────────────────────

const CANCEL = /^\s*(cancel|stop|exit|reset|start over|menu)\s*$/i;
const EMERGENCY = /chest\s+pain|breathing\s+problem|difficulty\s+breathing|can'?t\s+breathe|cannot\s+breathe|trouble\s+breathing|heavy\s+bleeding|severe\s+bleeding|\bemergency\b|heart\s+attack|unconscious|stroke|seizure|poison/i;
const GREETING = /^\s*(hi|hii+|hello|hey|namaste|namaskar|good\s+(morning|afternoon|evening)|help|start|menu)\b/i;
const BOOK = /\b(book|appointment|schedule|see\s+(a\s+)?doctor|consult|visit)\b/i;
const UPCOMING = /\b(my\s+appointments?|upcoming|booked|when\s+is\s+my)\b/i;
const PRESCRIPTION = /\b(prescriptions?|medicines?|medication|rx)\b/i;

const MENU: Reply["buttons"] = [{ id: "menu_book", title: "Book appointment" }, { id: "menu_upcoming", title: "My appointments" }, { id: "menu_rx", title: "My prescriptions" }];

async function hospitalLine(hospitalId: number): Promise<{ name: string; phone: string }> {
  const h = await hospitalsRepo.getRow(hospitalId);
  return { name: h?.name?.trim() || "the hospital", phone: String(h?.phone ?? "").trim() };
}

async function menuReply(hospitalId: number, name: string): Promise<Reply> {
  const h = await hospitalLine(hospitalId);
  return { text: `Hello${name ? ` ${name.split(" ")[0]}` : ""}! Welcome to *${h.name}*. How can I help you today?`, buttons: MENU };
}

async function emergencyReply(hospitalId: number): Promise<Reply> {
  const h = await hospitalLine(hospitalId);
  return {
    text: [
      "*Important — your wellbeing comes first*", "",
      "If this may be life-threatening, please call your local emergency number *immediately*.", "",
      h.phone ? `You can also call *${h.name}* on ${h.phone}, or come straight to our emergency department.` : `Please contact *${h.name}* urgently, or come straight to our emergency department.`,
    ].join("\n"),
  };
}

// ── Dates ────────────────────────────────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const iso = (y: number, m: number, d: number): string | null => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? dt.toISOString().slice(0, 10) : null;
};
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "today", "tomorrow", "2026-11-03", "3/11", "3 Nov", "Nov 3" → a date; a day-month already past means next year. */
export function parseDate(text: string, today: string): string | null {
  const t = text.trim().toLowerCase();
  if (/^(today|aaj)$/.test(t)) return today;
  if (/^(tomorrow|tmrw|tom|kal)$/.test(t)) return addDays(today, 1);
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return iso(+m[1], +m[2], +m[3]);
  const year = +today.slice(0, 4);
  let day: number | null = null, mon: number | null = null, yr = year;
  if ((m = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?$/.exec(t))) { day = +m[1]; mon = +m[2]; if (m[3]) yr = +m[3] < 100 ? 2000 + +m[3] : +m[3]; }
  else if ((m = /^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})$/.exec(t))) { day = +m[1]; mon = MONTHS.indexOf(m[2].slice(0, 3)) + 1; }
  else if ((m = /^([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?$/.exec(t))) { day = +m[2]; mon = MONTHS.indexOf(m[1].slice(0, 3)) + 1; }
  if (!day || !mon) return null;
  let out = iso(yr, mon, day);
  if (out && out < today && !/\d{4}$|\d{2}$/.test(t.split(/[/.\-\s]/).pop() ?? "")) out = iso(year + 1, mon, day);
  return out;
}

const niceDate = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

// ── Booking an appointment ───────────────────────────────────────────────────

async function startBooking(hospitalId: number, phone: string, ctx: Ctx, waName: string): Promise<Reply> {
  const patient = await patientByPhone(hospitalId, phone);
  ctx.booking = { step: patient ? "doctor" : "name", patientId: patient?.id ?? null, name: patient?.name ?? waName, age: patient?.age ?? 0, doctors: [], slots: [] };
  if (patient) return doctorList(hospitalId, ctx.booking, `Booking for *${patient.name}*.`);
  return { text: "Let's book your appointment. What is the patient's *full name*?" };
}

async function doctorList(hospitalId: number, b: Booking, lead: string): Promise<Reply> {
  const { rows } = await doctorsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }] } as never);
  const docs = (rows as DoctorRow[]).filter((d) => d.status !== "On Leave").slice(0, 9);
  if (!docs.length) { return { text: "Sorry, no doctors are taking appointments right now. Please call the hospital." }; }
  b.doctors = docs.map((d) => ({ id: d.id, name: d.name }));
  b.step = "doctor";
  return { text: `${lead}\n\nWhich doctor would you like to see? Reply with a number:\n${docs.map((d, i) => `${i + 1}. ${d.name}${d.specialty ? ` — ${d.specialty}` : ""}`).join("\n")}` };
}

const DATE_BUTTONS = [{ id: "date_today", title: "Today" }, { id: "date_tomorrow", title: "Tomorrow" }];

async function showSlots(b: Booking): Promise<Reply> {
  const res = await slotsFor({ doctorId: b.doctorId!, date: b.date!, mode: "in_person" });
  const open = res.slots.filter((s) => s.status === "open").slice(0, 10);
  if (!res.isOpen || !open.length) {
    b.step = "date";
    return { text: `${res.closedReason || "There are no free times that day."} Please send another date (like *3 Nov*).`, buttons: DATE_BUTTONS };
  }
  b.slots = open.map((s) => ({ value: s.value, label: s.label }));
  b.step = "slot";
  return { text: `Free times with *${b.doctorName}* on *${niceDate(b.date!)}*. Reply with a number:\n${open.map((s, i) => `${i + 1}. ${s.label}`).join("\n")}` };
}

/** A pick from a numbered list: "2", "2.", or part of the name. */
function pick<T>(text: string, items: T[], label: (x: T) => string): T | null {
  const n = /^\s*(\d{1,2})\s*[.)]?\s*$/.exec(text);
  if (n) return items[+n[1] - 1] ?? null;
  const t = text.trim().toLowerCase();
  if (t.length < 3) return null;
  const hits = items.filter((x) => label(x).toLowerCase().includes(t));
  return hits.length === 1 ? hits[0] : null;
}

async function continueBooking(hospitalId: number, phone: string, ctx: Ctx, m: InboundMessage): Promise<Reply> {
  const b = ctx.booking!;
  const text = m.text.trim();
  const today = localDate();
  switch (b.step) {
    case "name":
      if (text.length < 2 || text.length > 80) return { text: "Please send the patient's full name." };
      b.name = text; b.step = "age";
      return { text: "Thanks. And the patient's *age* in years?" };
    case "age": {
      const age = Number(text.replace(/\D/g, ""));
      if (!Number.isInteger(age) || age < 0 || age > 120 || !/\d/.test(text)) return { text: "Please send the age as a number, like *34*." };
      b.age = age;
      return doctorList(hospitalId, b, "Thank you.");
    }
    case "doctor": {
      const d = pick(text, b.doctors, (x) => x.name);
      if (!d) return { text: "Please reply with the number of the doctor from the list." };
      b.doctorId = d.id; b.doctorName = d.name; b.step = "date";
      return { text: `Great — *${d.name}*. Which day? Tap a button or send a date (like *3 Nov*).`, buttons: DATE_BUTTONS };
    }
    case "date": {
      const d = m.buttonId === "date_today" ? today : m.buttonId === "date_tomorrow" ? addDays(today, 1) : parseDate(text, today);
      if (!d) return { text: "I couldn't read that date. Try *today*, *tomorrow* or something like *3 Nov*.", buttons: DATE_BUTTONS };
      if (d < today) return { text: "That date has already passed. Please send a future date.", buttons: DATE_BUTTONS };
      b.date = d;
      return showSlots(b);
    }
    case "slot": {
      const byTime = (() => { const mins = parseClock(text.replace(/\s+/g, " ")); return mins === null ? null : b.slots.find((s) => parseClock(s.value) === mins) ?? null; })();
      const s = byTime ?? pick(text, b.slots, (x) => x.label);
      if (!s) return { text: "Please reply with the number of a time from the list." };
      b.time = s.value; b.step = "reason";
      return { text: `*${s.label}* it is. What is the visit for? (a few words, or send *skip*)` };
    }
    case "reason":
      b.reason = /^skip$/i.test(text) ? "" : text.slice(0, 200); b.step = "confirm";
      return {
        text: `Please confirm your appointment:\n\n*Patient:* ${b.name}\n*Doctor:* ${b.doctorName}\n*Date:* ${niceDate(b.date!)}\n*Time:* ${to12h(parseClock(b.time!) ?? 0)}${b.reason ? `\n*Reason:* ${b.reason}` : ""}`,
        buttons: [{ id: "book_confirm", title: "Confirm" }, { id: "book_cancel", title: "Cancel" }],
      };
    case "confirm": {
      const yes = m.buttonId === "book_confirm" || /^(yes|y|confirm|ok|okay|haan)$/i.test(text);
      const no = m.buttonId === "book_cancel" || /^(no|n|cancel)$/i.test(text);
      if (no) { ctx.booking = null; return { text: "No problem — nothing was booked. Say *hi* any time to start again.", buttons: MENU }; }
      if (!yes) return { text: "Tap *Confirm* to book, or *Cancel* to stop.", buttons: [{ id: "book_confirm", title: "Confirm" }, { id: "book_cancel", title: "Cancel" }] };
      try {
        const { doctor, hospital } = await loadDoctor(b.doctorId!);
        await bookInPerson({ hospitalId, patientId: b.patientId, patientName: b.name, patientAge: b.age, doctor, hospital, date: b.date!, minutes: parseClock(b.time!)!, reason: b.reason || "Booked on WhatsApp" });
      } catch (e) {
        if (isAppError(e)) { b.step = "date"; return { text: `${e.message}\n\nPlease pick another day or time — send a date (like *3 Nov*).`, buttons: DATE_BUTTONS }; }
        throw e;
      }
      const done = b;
      ctx.booking = null;
      return { text: `Your appointment is booked ✅\n\n*${done.doctorName}*\n${niceDate(done.date!)} at ${to12h(parseClock(done.time!) ?? 0)}\n\nPlease arrive 10 minutes early. Reply *my appointments* any time to see it.` };
    }
  }
}

// ── Appointments and prescriptions ───────────────────────────────────────────

async function upcomingReply(hospitalId: number, phone: string): Promise<Reply> {
  const patient = await patientByPhone(hospitalId, phone);
  if (!patient) return { text: "I couldn't find a patient record for this number. Please call the hospital, or say *book* to make an appointment.", buttons: MENU };
  const today = localDate();
  const { rows } = await appointmentsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "patient_id", op: "eq", value: patient.id }] } as never);
  const next = (rows as AppointmentRow[]).filter((a) => a.appointment_date >= today && a.status !== "Cancelled" && a.status !== "Completed")
    .sort((a, b) => a.appointment_date.localeCompare(b.appointment_date) || (parseClock(a.appointment_time) ?? 0) - (parseClock(b.appointment_time) ?? 0)).slice(0, 5);
  if (!next.length) return { text: `Hi ${patient.name.split(" ")[0]}, you have no upcoming appointments. Would you like to book one?`, buttons: [{ id: "menu_book", title: "Book appointment" }] };
  return { text: `Your upcoming appointments:\n\n${next.map((a) => `• *${niceDate(a.appointment_date)}* at ${a.appointment_time} — ${a.doctor}`).join("\n")}` };
}

async function prescriptionsReply(hospitalId: number, phone: string): Promise<Reply> {
  const patient = await patientByPhone(hospitalId, phone);
  if (!patient) return { text: "I couldn't find a patient record for this number. Please call the hospital for your prescriptions." };
  const { rows } = await prescriptionsRepo.listRows({ unpaged: true, filters: [{ column: "hospital_id", op: "eq", value: hospitalId }, { column: "patient_id", op: "eq", value: patient.id }] } as never);
  const list = (rows as PrescriptionRow[]).sort((a, b) => b.prescribed_date.localeCompare(a.prescribed_date) || b.id - a.id).slice(0, 3);
  if (!list.length) return { text: "There are no prescriptions on your record yet." };
  return { text: `Your latest prescriptions:\n\n${list.map((r) => `• *${r.rx_number}* — ${niceDate(r.prescribed_date)} by ${r.doctor}${r.diagnosis ? `\n  ${r.diagnosis}` : ""}\n  ${r.medicine_count} medicine${r.medicine_count === 1 ? "" : "s"}`).join("\n")}\n\nFor the full prescription please collect it from the hospital or ask your doctor.` };
}

// ── AI fallback ──────────────────────────────────────────────────────────────

async function aiReply(hospitalId: number, ctx: Ctx, text: string): Promise<Reply> {
  const h = await hospitalLine(hospitalId);
  const canned = `Thank you for your message. For this, please contact *${h.name}*${h.phone ? ` on ${h.phone}` : ""} and our team will help. You can also say *hi* to book an appointment.`;
  if (!isGeminiLive()) return { text: canned, buttons: MENU };
  const system = [
    `You are the WhatsApp assistant of ${h.name}, a hospital. Answer in at most 4 short sentences, in the language the patient writes in.`,
    "Be warm and plain. Never diagnose, prescribe or give medicine doses. Never invent facts about the hospital, doctors, prices or timings you were not given.",
    `If you don't know, or it needs a person, tell them to contact the hospital${h.phone ? ` on ${h.phone}` : ""}. For health worries add: "This is general information, not medical advice."`,
    "To book an appointment tell them to say *book*.",
  ].join("\n");
  const contents = [...ctx.history.slice(-6).map((t) => ({ role: t.role, parts: [{ text: t.text }] })), { role: "user" as const, parts: [{ text }] }];
  let out = "";
  try {
    for await (const chunk of streamGenerateContent({ systemInstruction: system, contents, tools: [] })) {
      if (chunk.type === "text") out += chunk.delta;
      if (chunk.type === "error") { logger.warn("whatsapp.ai_error", { detail: chunk.detail }); return { text: canned, buttons: MENU }; }
    }
  } catch (e) { logger.warn("whatsapp.ai_failed", { error: String(e) }); return { text: canned, buttons: MENU }; }
  return { text: out.trim() || canned };
}

// ── One inbound message ──────────────────────────────────────────────────────

async function route(hospitalId: number, m: InboundMessage, ctx: Ctx): Promise<Reply> {
  const text = m.text.trim();
  if (CANCEL.test(text) || m.buttonId === "book_cancel" && !ctx.booking) { ctx.booking = null; return menuReply(hospitalId, m.name); }
  if (EMERGENCY.test(text)) { ctx.booking = null; return emergencyReply(hospitalId); }
  if (m.buttonId === "menu_book") return startBooking(hospitalId, m.from, ctx, m.name);
  if (m.buttonId === "menu_upcoming") return upcomingReply(hospitalId, m.from);
  if (m.buttonId === "menu_rx") return prescriptionsReply(hospitalId, m.from);
  if (ctx.booking) return continueBooking(hospitalId, m.from, ctx, m);
  if (GREETING.test(text) && text.split(/\s+/).length <= 3) return menuReply(hospitalId, m.name);
  if (UPCOMING.test(text)) return upcomingReply(hospitalId, m.from);
  if (PRESCRIPTION.test(text)) return prescriptionsReply(hospitalId, m.from);
  if (BOOK.test(text)) return startBooking(hospitalId, m.from, ctx, m.name);
  return aiReply(hospitalId, ctx, text);
}

async function handleInbound(m: InboundMessage): Promise<void> {
  const account = await accountByPhoneNumberId(m.phoneNumberId);
  if (!account) { logger.warn("whatsapp.unknown_number", { phoneNumberId: m.phoneNumberId }); return; }
  const out: Outbound | null = outboundOf(account);
  const supported = m.type === "text" || m.type === "button" || m.type === "interactive";
  await logMessage({ hospitalId: account.hospital_id, direction: "in", phone: m.from, kind: "bot", body: supported ? m.text : `[${m.type}]`, waMessageId: m.id, status: "received" });
  if (!account.bot_enabled || !out) return;
  if (!supported || !m.text.trim()) {
    await reply(out, m.from, "I can read text messages only. Please type your question, or say *hi* for the menu.", MENU);
    return;
  }
  const ctx = ctxOf(account.hospital_id, m.from);
  const r = await route(account.hospital_id, m, ctx);
  ctx.history.push({ role: "user", text: m.text }, { role: "model", text: r.text });
  if (ctx.history.length > 12) ctx.history.splice(0, ctx.history.length - 12);
  await reply(out, m.from, r.text, r.buttons);
}

/** For tests: forget every conversation and every seen message id. */
export function resetBot(): void { contexts.clear(); seen.clear(); }
