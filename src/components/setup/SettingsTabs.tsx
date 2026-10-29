"use client";

/** Settings tabs other than Profile & branding: Billing, Notifications, Security, Appearance (this device) and Protocols. */
import { useState, useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Pencil, Sun } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { AdminUserDTO } from "@/types/api";
import { PAYMENT_GROUPS } from "@/types/setup";
import { THEME_COLORS, MY_COLOR_KEY, applyTheme } from "@/lib/theme";
import { setColorMode, useColorMode } from "@/lib/color-mode";
import { DEFAULT_UNITS, readUnits, saveUnits, type Units } from "@/lib/units";
import { ErrorNote, outlineBtn, primaryBtn } from "@/components/mrd/shared";
import { attempt } from "@/components/hr/shared";
import { FormInput } from "@/components/shared/FormRow";
import { ConfigCard } from "@/components/setup/ConfigCard";
import { AddButton, EditIcon, FormDialog, ListBox, Muted, Row, num, str, useConfig, useSetup, type FieldSpec, type Rec } from "@/components/setup/ui";

const card = "rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5";

// ── Billing ──────────────────────────────────────────────────────────────────

const INVOICING: FieldSpec[][] = [
  [{ key: "invoicePrefix", label: "Invoice prefix", mono: true, upper: true }, { key: "gstin", label: "GSTIN", mono: true, upper: true }],
  [{ key: "clinicStateCode", label: "Clinic state code", mono: true }, { key: "upiVpa", label: "UPI VPA (for QR)", mono: true }],
];
const INVOICING_CHIPS: FieldSpec[] = [{ key: "gstOnBills", label: "GST enabled", type: "toggle" }, { key: "pricesInclusive", label: "Prices are tax-inclusive", type: "toggle" }, { key: "roundOff", label: "Round off invoice totals", type: "toggle" }];

export function BillingTab({ canEdit }: { canEdit: boolean }) {
  const { item: hospital, reload: reloadHospital } = useConfig("hospital");
  const { item: billing, reload: reloadBilling } = useConfig("billing");
  const users = useList<AdminUserDTO>("/admin/users", { all: true });
  if (!hospital || !billing) return <p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  const roleLimits = (billing.roleDiscountLimits ?? {}) as Record<string, number | null>;
  const userLimits = (billing.userDiscountLimits ?? {}) as Record<string, number | null>;
  return (
    <div className="flex flex-col gap-4">
      <ConfigCard title="Invoicing & GST" configKey="hospital" rows={[...INVOICING, [{ key: "invoiceFooter", label: "Invoice footer note" }]]} chips={INVOICING_CHIPS} values={hospital} canEdit={canEdit} onSaved={reloadHospital} />
      <ModesCard modes={((billing.manualPaymentModes as string[]) ?? [])} canEdit={canEdit} onSaved={reloadBilling} />
      <LimitsCard title="Per-role discount limits (%)" note="The most a person in this role can discount a bill without approval. Empty means no limit set."
        entries={["Receptionist", "Billing staff", "Doctor"].map((r) => ({ key: r, label: r, value: roleLimits[r] ?? null }))} canEdit={canEdit} onSave={(map) => api.put("/setup/config/billing", { roleDiscountLimits: map }).then(reloadBilling)} />
      <LimitsCard title="Per-user discount limits (%)" note="Overrides the role limit for one person. Blank = role default; -1 = unlimited." signed
        entries={users.items.filter((u) => u.status !== "Inactive").map((u) => ({ key: String(u.id), label: `${u.name}`, sub: `(${u.role.toLowerCase()})`, value: userLimits[String(u.id)] ?? null }))} canEdit={canEdit} onSave={(map) => api.put("/setup/config/billing", { userDiscountLimits: map }).then(reloadBilling)} />
    </div>
  );
}

function ModesCard({ modes, canEdit, onSaved }: { modes: string[]; canEdit: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState<string[]>(modes);
  const { run, loading, error, reset } = useMutation();
  async function save() { reset(); if (await attempt(run(() => api.put("/setup/config/billing", { manualPaymentModes: picked })))) { setEditing(false); onSaved(); } }
  return (
    <section className={card}>
      <div className="mb-2 flex items-center gap-3"><h2 className="text-[14px] font-semibold">Manual payment modes</h2>
        {canEdit && !editing && <button onClick={() => { setPicked(modes); setEditing(true); }} className={outlineBtn + " ml-auto !h-[30px]"}><Pencil size={13} /> Edit</button>}
        {editing && <span className="ml-auto flex gap-2"><button onClick={() => setEditing(false)} className={outlineBtn + " !h-[30px]"}>Cancel</button><button onClick={save} disabled={loading} className={primaryBtn + " !h-[30px]"}>{loading ? "Saving…" : "Save"}</button></span>}
      </div>
      {editing ? (
        <div className="flex flex-wrap gap-2">{PAYMENT_GROUPS.map((g) => <label key={g} className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-[color:var(--line)] px-3 py-[6px] text-[14px]"><input type="checkbox" checked={picked.includes(g)} onChange={(e) => setPicked(e.target.checked ? [...picked, g] : picked.filter((x) => x !== g))} />{g}</label>)}</div>
      ) : <p className="text-[14px]">{modes.length ? modes.join(", ") : <Muted>None</Muted>}</p>}
      <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">Modes a cashier can record by hand, without a card terminal or gateway.</p>
      <ErrorNote message={error?.message} />
    </section>
  );
}

function LimitsCard({ title, note, entries, canEdit, onSave, signed }: { title: string; note: string; entries: { key: string; label: string; sub?: string; value: number | null }[]; canEdit: boolean; onSave: (m: Record<string, number | null>) => Promise<unknown>; signed?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const { run, loading, error, reset } = useMutation();
  const start = () => { reset(); setDraft(Object.fromEntries(entries.map((e) => [e.key, e.value == null ? "" : String(e.value)]))); setEditing(true); };
  async function save() {
    reset();
    const map: Record<string, number | null> = {};
    for (const e of entries) { const v = (draft[e.key] ?? "").trim(); map[e.key] = v === "" ? null : Number(v); }
    if (Object.values(map).some((v) => v !== null && (!Number.isFinite(v) || v < (signed ? -1 : 0) || v > 100))) { return; }
    if (await attempt(run(() => onSave(map)))) setEditing(false);
  }
  const invalid = editing && entries.some((e) => { const v = (draft[e.key] ?? "").trim(); return v !== "" && (!Number.isFinite(Number(v)) || Number(v) < (signed ? -1 : 0) || Number(v) > 100); });
  return (
    <section className={card}>
      <div className="mb-1 flex items-center gap-3"><h2 className="text-[13px] text-[color:var(--ink-soft)]">{title}</h2>
        {canEdit && !editing && <button onClick={start} className={outlineBtn + " ml-auto !h-[30px]"}>Edit</button>}
        {editing && <span className="ml-auto flex gap-2"><button onClick={() => setEditing(false)} className={outlineBtn + " !h-[30px]"}>Cancel</button><button onClick={save} disabled={loading || invalid} className={primaryBtn + " !h-[30px]"}>{loading ? "Saving…" : "Save"}</button></span>}
      </div>
      <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">{note}</p>
      <div className="grid gap-x-6 gap-y-3" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
        {entries.map((e) => (
          <div key={e.key} className="min-w-0">
            <p className="truncate text-[14px] font-medium">{e.label} {e.sub && <span className="font-normal text-[color:var(--ink-soft)]">{e.sub}</span>}</p>
            {editing ? <FormInput type="number" min={signed ? "-1" : "0"} max="100" value={draft[e.key] ?? ""} placeholder={signed ? "Role default" : "Not set"} onChange={(v) => setDraft((d) => ({ ...d, [e.key]: v }))} />
              : <p className={`text-[14px] ${e.value == null ? "text-[color:var(--ink-soft)]" : "font-mono"}`}>{e.value == null ? (signed ? "Role default (0%)" : "Not set") : e.value === -1 ? "Unlimited" : `${num(e.value).toFixed(2)}%`}</p>}
          </div>
        ))}
        {entries.length === 0 && <Muted>No people to list.</Muted>}
      </div>
      {invalid && <p role="alert" className="mt-2 text-[12px] text-[#c8001a]">Use a number from {signed ? "-1" : "0"} to 100.</p>}
      <ErrorNote message={error?.message} />
    </section>
  );
}

// ── Notifications and security ───────────────────────────────────────────────

export function NotificationsTab({ canEdit }: { canEdit: boolean }) {
  const { item, reload } = useConfig("notifications");
  if (!item) return <p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <div className="flex flex-col gap-4">
      <ConfigCard title="Channels" configKey="notifications" values={item} canEdit={canEdit} onSaved={reload} note="How the hospital reaches patients and staff."
        rows={[[{ key: "email", label: "Email", type: "toggle" }], [{ key: "sms", label: "SMS", type: "toggle" }], [{ key: "whatsapp", label: "WhatsApp", type: "toggle" }]]} />
      <ConfigCard title="What gets sent" configKey="notifications" values={item} canEdit={canEdit} onSaved={reload}
        rows={[[{ key: "appointmentReminders", label: "Appointment reminders", type: "toggle" }, { key: "reminderHoursBefore", label: "Remind this many hours before", type: "number" }], [{ key: "labReportReady", label: "Tell the patient when a lab report is ready", type: "toggle" }], [{ key: "invoiceOnBilling", label: "Send the invoice when a bill is paid", type: "toggle" }], [{ key: "lowStockAlerts", label: "Alert pharmacy and stores about low stock", type: "toggle" }], [{ key: "dailySummaryEmail", label: "Email a daily summary to management", type: "toggle" }], [{ key: "summaryRecipients", label: "Summary recipients (comma-separated emails)" }]]} />
    </div>
  );
}

export function SecurityTab({ canEdit }: { canEdit: boolean }) {
  const { item, reload } = useConfig("security");
  if (!item) return <p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p>;
  return (
    <ConfigCard title="Sign-in & access" configKey="security" values={item} canEdit={canEdit} onSaved={reload} note="The hospital's access policy. Recorded here for administrators; the sign-in service does not enforce the timeout, lockout or password rules yet."
      rows={[[{ key: "sessionTimeoutMinutes", label: "Sign people out after (minutes idle)", type: "number" }, { key: "lockoutAttempts", label: "Lock an account after failed attempts", type: "number" }], [{ key: "minPasswordLength", label: "Minimum password length", type: "number" }, { key: "auditRetentionDays", label: "Keep the audit trail for (days)", type: "number" }], [{ key: "requireMixedCase", label: "Passwords need upper- and lower-case letters", type: "toggle" }], [{ key: "twoFactorForAdmins", label: "Require two-factor sign-in for administrators", type: "toggle" }]]} />
  );
}

// ── Appearance (this device) ─────────────────────────────────────────────────

function useUnits(): [Units, (u: Units) => void] {
  const subscribe = (cb: () => void) => { window.addEventListener("storage", cb); window.addEventListener("samvaad:units", cb); return () => { window.removeEventListener("storage", cb); window.removeEventListener("samvaad:units", cb); }; };
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify(readUnits()), () => JSON.stringify(DEFAULT_UNITS));
  return [JSON.parse(raw) as Units, (u) => { saveUnits(u); window.dispatchEvent(new Event("samvaad:units")); }];
}

function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: React.ReactNode }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] p-[2px]">
      {options.map((o) => <button key={o.value} role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)} className={`inline-flex h-[28px] items-center gap-1 rounded-[6px] px-3 text-[13px] cursor-pointer ${value === o.value ? "bg-[color:var(--surface)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>{o.icon}{o.label}</button>)}
    </div>
  );
}

export function AppearanceTab({ hospitalColour }: { hospitalColour: string }) {
  const [units, setUnits] = useUnits();
  const { mode } = useColorMode();
  const [mine, setMine] = useState<string>(() => { try { return localStorage.getItem(MY_COLOR_KEY) ?? ""; } catch { return ""; } });
  const choose = (key: string) => {
    setMine(key);
    try { if (key) localStorage.setItem(MY_COLOR_KEY, key); else localStorage.removeItem(MY_COLOR_KEY); } catch { /* not remembered */ }
    applyTheme(key || hospitalColour);
  };
  const row = (label: string, hint: string, control: React.ReactNode) => <div className="flex items-center justify-between gap-4 py-2"><div><p className="text-[14px] font-medium">{label}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p></div>{control}</div>;
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="text-[13px] text-[color:var(--ink-soft)]">Measurement units</h2>
        <p className="mb-2 mt-1 max-w-[620px] text-[13px] text-[color:var(--ink-soft)]">How vitals are entered and shown on this device. Readings are always stored in metric, so a value entered in °F here reads correctly in °C on every other device.</p>
        {row("Temperature", "Celsius or Fahrenheit", <Segmented label="Temperature" value={units.temperature} onChange={(v) => setUnits({ ...units, temperature: v })} options={[{ value: "C", label: "°C" }, { value: "F", label: "°F" }]} />)}
        {row("Height", "Centimetres or feet and inches", <Segmented label="Height" value={units.height} onChange={(v) => setUnits({ ...units, height: v })} options={[{ value: "cm", label: "cm" }, { value: "ftin", label: "ft/in" }]} />)}
        {row("Weight", "Kilograms or pounds", <Segmented label="Weight" value={units.weight} onChange={(v) => setUnits({ ...units, weight: v })} options={[{ value: "kg", label: "kg" }, { value: "lb", label: "lb" }]} />)}
        {row("Blood glucose", "mg/dL or mmol/L", <Segmented label="Blood glucose" value={units.glucose} onChange={(v) => setUnits({ ...units, glucose: v })} options={[{ value: "mgdl", label: "mg/dL" }, { value: "mmol", label: "mmol/L" }]} />)}
      </section>
      <section className={card}>
        <h2 className="text-[13px] text-[color:var(--ink-soft)]">Theme</h2>
        {row("Light or dark", "Use a light or dark appearance. Saved on this device.", (
          <Segmented label="Light or dark" value={mode} onChange={(v) => setColorMode(v)} options={[{ value: "light", label: "Light", icon: <Sun size={13} /> }, { value: "dark", label: "Dark", icon: <Moon size={13} /> }]} />
        ))}
        <div className="mt-1 flex items-center gap-2 border-t border-[color:var(--line)] pt-3">
          <Monitor size={14} className="text-[color:var(--ink-soft)]" />
          <button onClick={() => setColorMode(window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light")} className="text-[13px] text-[color:var(--brand)] hover:underline cursor-pointer">Match this device&apos;s setting now</button>
        </div>
        <p className="mt-4 text-[14px] font-medium">Theme colour</p>
        <p className="mb-2 text-[12px] text-[color:var(--ink-soft)]">Follow your hospital&apos;s colour, or keep one of your own on this device. The hospital&apos;s colour is set under Profile &amp; branding.</p>
        <div role="radiogroup" aria-label="Theme colour" className="flex flex-wrap gap-2">
          {[{ key: "", label: "Hospital's", hex: THEME_COLORS.find((c) => c.key === hospitalColour)?.hex ?? "#009598" }, ...THEME_COLORS].map((c) => {
            const selected = mine === c.key;
            return (
              <button key={c.key || "hospital"} role="radio" aria-checked={selected} onClick={() => choose(c.key)} className={`flex w-[76px] flex-col items-center gap-1 rounded-[10px] border-2 p-2 cursor-pointer ${selected ? "border-[color:var(--brand-ring)] bg-[color:var(--brand-soft)]" : "border-transparent hover:bg-[color:var(--subtle)]"}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: c.hex }}>{selected && <Check size={15} className="text-white" strokeWidth={2.5} />}</span>
                <span className="text-[11px] text-[color:var(--ink-soft)]">{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Protocols ────────────────────────────────────────────────────────────────

export function ProtocolsTab({ canEdit }: { canEdit: boolean }) {
  const protocols = useSetup("protocol");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  return (
    <section className={card}>
      <div className="mb-3 flex items-center gap-3">
        <div><h2 className="text-[14px] font-semibold">Clinical protocols</h2><p className="text-[12px] text-[color:var(--ink-soft)]">Step-by-step pathways staff can follow at the bedside.</p></div>
        {canEdit && <span className="ml-auto"><AddButton primary label="New protocol" onClick={() => setEditing("new")} /></span>}
      </div>
      <ListBox>
        {protocols.items.map((p) => (
          <Row key={p.id}>
            <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{p.name}</p><p className="truncate text-[12px] text-[color:var(--ink-soft)]">{str(p.data.category)}{str(p.data.category) && " · "}{((p.data.steps as string[]) ?? []).length} steps</p></div>
            {canEdit && <EditIcon label={`Edit ${p.name}`} onClick={() => setEditing(p)} />}
          </Row>
        ))}
        {protocols.items.length === 0 && <p className="px-4 py-8 text-center text-[14px] text-[color:var(--ink-soft)]">No protocols yet.</p>}
      </ListBox>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} width={560} title={editing === "new" ? "New protocol" : "Edit protocol"} subtitle="Name it, say what it is for, then list the steps in order."
          endpoint="/setup/protocol" id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? "Add protocol" : "Save changes"} deleteLabel="Delete protocol"
          initial={editing === "new" ? { active: true } : { name: editing.name, category: editing.data.category, description: editing.data.description, steps: ((editing.data.steps as string[]) ?? []).join("\n"), active: editing.active }}
          rows={[[{ key: "name", label: "Name" }, { key: "category", label: "Category" }], [{ key: "description", label: "Purpose", type: "textarea", rows: 2 }], [{ key: "steps", label: "Steps (one per line)", type: "textarea", rows: 7 }], [{ key: "active", label: "Active", type: "toggle" }]]}
          prepare={(v) => ({ ...v, steps: String(v.steps ?? "").split("\n").map((s) => s.trim()).filter(Boolean) })}
          onClose={() => { setEditing(null); protocols.reload(); }} />
      )}
    </section>
  );
}
