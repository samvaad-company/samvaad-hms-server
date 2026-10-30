/**
 * Reports → AI monitor: how much the AI features are being used and how they are doing — the consultation scribe, the AI chat
 * assistant and the WhatsApp bot — over the last 7, 30 or 90 days. Read-only, and counts only: what staff asked the assistant and
 * what patients wrote to the bot is never shown here, since anyone allowed to see reports could otherwise read it.
 */
import { chatMessagesRepo, chatThreadsRepo, scribeNotesRepo, whatsappMessagesRepo } from "@/repositories";
import type { ChatMessageRow, ChatThreadRow, ScribeNoteRow, WhatsappMessageRow } from "@/db/tables";
import { type Session } from "@/auth/session";
import { requireHospitalId, scopeToHospital } from "@/services/hospital-scope";
import { localDate } from "@/lib/clock";
import type { AiMonitorDTO } from "@shared/types/api";

const all = async <T>(repo: { listRows(o: never): Promise<{ rows: unknown[] }> }, actor: Session): Promise<T[]> =>
  (await repo.listRows(scopeToHospital({ unpaged: true }, actor) as never)).rows as T[];

const addDays = (iso: string, n: number): string => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };
const dayOf = (ts: string): string => localDate(new Date(ts));
const tally = <T>(rows: T[], key: (r: T) => string): { name: string; notes: number }[] => {
  const m = new Map<string, number>();
  for (const r of rows) { const k = key(r) || "—"; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].map(([name, notes]) => ({ name, notes })).sort((a, b) => b.notes - a.notes).slice(0, 8);
};

export async function getAiMonitor(rawDays: number, actor: Session): Promise<AiMonitorDTO> {
  requireHospitalId(actor);
  const days = [7, 30, 90].includes(rawDays) ? rawDays : 30;
  const today = localDate();
  const since = addDays(today, -(days - 1));
  const [notesAll, threads, wa] = await Promise.all([all<ScribeNoteRow>(scribeNotesRepo, actor), all<ChatThreadRow>(chatThreadsRepo, actor), all<WhatsappMessageRow>(whatsappMessagesRepo, actor)]);
  const threadIds = new Set(threads.map((t) => t.id));
  const messagesAll = ((await chatMessagesRepo.listRows({ unpaged: true })).rows as ChatMessageRow[]).filter((m) => threadIds.has(m.thread_id));

  const notes = notesAll.filter((n) => dayOf(n.created_at) >= since);
  const messages = messagesAll.filter((m) => dayOf(m.created_at) >= since);
  const questions = messages.filter((m) => m.role === "user");
  const answers = messages.filter((m) => m.role !== "user");
  const bot = wa.filter((m) => dayOf(m.created_at) >= since);
  const threadOf = new Map(threads.map((t) => [t.id, t] as const));

  const bucket = <T extends { created_at: string }>(rows: T[]) => { const m = new Map<string, number>(); for (const r of rows) { const d = dayOf(r.created_at); m.set(d, (m.get(d) ?? 0) + 1); } return m; };
  const sN = bucket(notes); const sC = bucket(questions); const sW = bucket(bot);
  const series = Array.from({ length: days }, (_, i) => { const date = addDays(since, i); return { date, scribe: sN.get(date) ?? 0, chat: sC.get(date) ?? 0, whatsapp: sW.get(date) ?? 0 }; });

  return {
    days, since, series,
    scribe: {
      notes: notes.length, minutes: Math.round(notes.reduce((n, x) => n + Number(x.duration_sec || 0), 0) / 60), patients: new Set(notes.map((n) => n.patient_id ?? n.patient_name)).size,
      byDoctor: tally(notes, (n) => n.doctor_name), byLanguage: tally(notes, (n) => n.language), byStatus: tally(notes, (n) => n.status),
      recent: [...notes].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map((n) => ({ id: n.id, at: n.created_at, patient: n.patient_name, doctor: n.doctor_name, language: n.language, seconds: Number(n.duration_sec || 0), status: n.status })),
    },
    chat: { threads: new Set(questions.map((q) => q.thread_id)).size, questions: questions.length, answers: answers.length, users: new Set(questions.map((q) => threadOf.get(q.thread_id)?.user_id)).size },
    whatsapp: {
      received: bot.filter((m) => m.direction === "in").length, sent: bot.filter((m) => m.direction === "out").length, failed: bot.filter((m) => m.status === "failed").length, people: new Set(bot.map((m) => m.phone)).size,
      recent: [...bot].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8).map((m) => ({ id: m.id, at: m.created_at, direction: m.direction, kind: m.kind, status: m.status })),
    },
  };
}
