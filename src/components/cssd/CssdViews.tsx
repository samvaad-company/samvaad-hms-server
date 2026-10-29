"use client";

/**
 * CSSD tabs. Board: every instrument set by department with where it is in the loop. Cycles: each sterilizer run and its
 * result. Issues: sets requested, out with patients, and returned. Settings: the chambers and how long a set stays sterile.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { PACKAGING, STERILIZATION_METHODS } from "@/types/cssd";
import type { CssdCycleDTO, CssdIssueDTO, CssdSetDTO, CssdShelfLifeDTO, CssdSterilizerDTO, CssdSummaryDTO } from "@/types/api";
import { attempt, dmy, Empty, ErrorNote, mono, outlineBtn, Pill, primaryBtn, softBtn, td, th } from "@/components/mrd/shared";
import { IssueDialog, PackDialog, QuarantineDialog, RequestDialog, ResultDialog, ReturnDialog, SterilizerDialog } from "@/components/cssd/CssdDialogs";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
/** "25 Sept, 09:57 pm" */
export function stamp12(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getHours() % 12 || 12;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${String(h).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "am" : "pm"}`;
}

// ── Alerts and the eight counts ──────────────────────────────────────────────

export function CssdHeader() {
  const { item: s } = useItem<CssdSummaryDTO>("/cssd/summary");
  if (!s) return null;
  const tiles: { label: string; value: number; tone?: string }[] = [
    { label: "Sterile", value: s.sterile, tone: "text-[#0b7a47]" }, { label: "In cycle", value: s.inCycle }, { label: "Packed", value: s.packed }, { label: "Dirty", value: s.dirty },
    { label: "Issued out", value: s.issuedOut }, { label: "Requests", value: s.requests, tone: s.requests > 0 ? "text-[#8a3b00]" : "" },
    { label: "Expiring 7d", value: s.expiring7d, tone: s.expiring7d > 0 ? "text-[#8a3b00]" : "" }, { label: "Expired", value: s.expired, tone: s.expired > 0 ? "text-[#c8001a]" : "" },
  ];
  return (
    <div className="flex flex-col gap-3 px-5 pt-4">
      {s.overdueSets.length > 0 && (
        <div role="alert" className="rounded-[8px] border border-[#f4a3ac] bg-[#fff0f1] px-4 py-3 text-[14px] text-[#b3001b]">
          {s.overdueSets.length} issued {s.overdueSets.length === 1 ? "set" : "sets"} past the expected return: {s.overdueSets.map((n, i) => <span key={n}><code className="font-mono">{n}</code>{i < s.overdueSets.length - 1 ? ", " : ""}</span>)}
        </div>
      )}
      {s.expired > 0 && <div role="status" className="rounded-[8px] border border-[#f3e29a] bg-[#fffbe0] px-4 py-3 text-[14px] text-[#7a5a00]">{s.expired} expired - reprocess before issue.</div>}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))" }}>
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 py-2">
            <p className={`font-mono text-[22px] font-bold leading-[28px] ${t.tone || "text-[color:var(--ink)]"}`}>{t.value}</p>
            <p className="text-[12px] text-[color:var(--ink-soft)]">{t.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────────────

export function BoardView({ canWrite, sets }: { canWrite: boolean; sets: CssdSetDTO[] }) {
  const { run, error, reset } = useMutation();
  const [packing, setPacking] = useState<CssdSetDTO | null>(null);
  const [requesting, setRequesting] = useState<CssdSetDTO | null>(null);
  const groups = new Map<string, CssdSetDTO[]>();
  for (const s of sets) { const k = s.departmentName || "No department"; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const names = [...groups.keys()].sort((a, b) => (a === "No department" ? 1 : b === "No department" ? -1 : a.localeCompare(b)));
  const reprocess = async (s: CssdSetDTO) => { reset(); await attempt(run(() => api.post(`/cssd/sets/${s.id}/reprocess`))); };

  return (
    <div className="px-5 pb-5 pt-4">
      <ErrorNote message={error?.message} />
      {sets.length === 0 && <Empty>No instrument sets yet — register the first one.</Empty>}
      {names.map((dept) => (
        <section key={dept} className="mb-5">
          <h3 className="mb-2 text-[13px] font-semibold text-[color:var(--ink)]">{dept}</h3>
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
            <table className="w-full min-w-[760px] text-left">
              <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Set", "Name", "Type", "Status", "Packaging", "Sterility", "Action"].map((h, i) => <th key={h} className={`${th} ${i === 6 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {groups.get(dept)!.map((s) => (
                  <tr key={s.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                    <td className={`${td} ${mono} whitespace-nowrap`}>{s.setNo}</td>
                    <td className={`${td} font-medium`}>{s.name}</td>
                    <td className={`${td} text-[color:var(--ink-soft)]`}>{s.type}</td>
                    <td className={td}><Pill>{s.status}</Pill></td>
                    <td className={td}>{s.packaging ?? "—"}</td>
                    <td className={`${td} ${mono} whitespace-nowrap ${s.status === "Expired sterility" ? "text-[#c8001a]" : ""}`}>{s.sterileUntil && (s.status === "Sterile" || s.status === "Expired sterility") ? `${dmy(s.sterileUntil)}${s.daysLeft != null && s.daysLeft >= 0 ? ` · ${s.daysLeft}d` : ""}` : "—"}</td>
                    <td className={`${td} text-right`}>
                      {s.status === "Expired sterility" && canWrite && <button onClick={() => reprocess(s)} className={outlineBtn}>Reprocess</button>}
                      {s.status === "Dirty" && canWrite && <button onClick={() => { reset(); setPacking(s); }} className={outlineBtn}>Pack</button>}
                      {s.status === "Packed" && <span className="text-[13px] text-[color:var(--ink-soft)]">awaiting cycle</span>}
                      {s.status === "In cycle" && <span className="text-[13px] text-[color:var(--ink-soft)]">in cycle</span>}
                      {s.status === "Issued" && <span className="text-[13px] text-[color:var(--ink-soft)]">issued out</span>}
                      {s.status === "Sterile" && canWrite && <button onClick={() => setRequesting(s)} className={softBtn}>Request</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {packing && <PackDialog key={packing.id} set={packing} onClose={() => setPacking(null)} />}
      {requesting && <RequestDialog key={requesting.id} sets={sets} presetSetId={requesting.id} onClose={() => setRequesting(null)} />}
    </div>
  );
}

// ── Cycles ───────────────────────────────────────────────────────────────────

export function CyclesView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<CssdCycleDTO>("/cssd/cycles");
  const [result, setResult] = useState<CssdCycleDTO | null>(null);
  const [quarantine, setQuarantine] = useState<CssdCycleDTO | null>(null);
  return (
    <div className="px-5 pb-5 pt-4">
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[820px] text-left">
          <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Cycle", "Sterilizer", "Method", "Started", "Load", "Indicator", "Status", "Action"].map((h, i) => <th key={h} className={`${th} ${i === 7 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]" title={c.setNos.join(", ")}>
                <td className={`${td} ${mono} whitespace-nowrap`}>{c.cycleNo}</td>
                <td className={`${td} font-medium`}>{c.sterilizerName}</td>
                <td className={`${td} text-[color:var(--ink-soft)]`}>{c.method}</td>
                <td className={`${td} ${mono} whitespace-nowrap`}>{stamp12(c.startedAt)}</td>
                <td className={`${td} ${mono}`}>{c.load}</td>
                <td className={`${td} text-[color:var(--ink-soft)]`}>{c.indicator}</td>
                <td className={td}><Pill>{c.status}</Pill></td>
                <td className={`${td} text-right`}>
                  {canWrite && c.status === "Running" && <button onClick={() => setResult(c)} className={softBtn}>Record result</button>}
                  {canWrite && c.status === "Passed" && <button onClick={() => setQuarantine(c)} className={outlineBtn}>Quarantine</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No cycles yet. Pack a set, then Start cycle.</Empty>}
      </div>
      {result && <ResultDialog key={result.id} cycle={result} onClose={() => setResult(null)} />}
      {quarantine && <QuarantineDialog key={quarantine.id} cycle={quarantine} onClose={() => setQuarantine(null)} />}
    </div>
  );
}

// ── Issues ───────────────────────────────────────────────────────────────────

export function IssuesView({ canWrite }: { canWrite: boolean }) {
  const { items, loading } = useList<CssdIssueDTO>("/cssd/issues");
  const { run, error, reset } = useMutation();
  const [issuing, setIssuing] = useState<CssdIssueDTO | null>(null);
  const [returning, setReturning] = useState<CssdIssueDTO | null>(null);
  const cancel = async (i: CssdIssueDTO) => { reset(); await attempt(run(() => api.post(`/cssd/issues/${i.id}/cancel`))); };
  return (
    <div className="px-5 pb-5 pt-4">
      <ErrorNote message={error?.message} />
      <div className="mt-1 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[900px] text-left">
          <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Issue no", "Set", "Status", "Patient", "Issued", "Expected back", "Charge", "Action"].map((h, i) => <th key={h} className={`${th} ${i === 7 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {items.filter((i) => i.status !== "Cancelled").map((i) => (
              <tr key={i.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} ${mono} whitespace-nowrap`}>{i.issueNo ?? "—"}</td>
                <td className={td}><span className={mono}>{i.setNo}</span> <span className="text-[color:var(--ink-soft)]">{i.setName}</span>{i.caseLabel && <span className="block text-[12px] text-[color:var(--ink-soft)]">{i.caseLabel}</span>}</td>
                <td className={td}><div className="flex flex-col items-start gap-1"><Pill>{i.status}</Pill>{i.investigate && <span title={i.returnNote} className="rounded-full border border-[#f4a3ac] bg-[#fff0f1] px-[10px] text-[12px] leading-[18px] text-[#b3001b]">investigate</span>}</div></td>
                <td className={td}>{i.patientName || "—"}</td>
                <td className={`${td} ${mono}`}>{stamp12(i.issuedAt)}</td>
                <td className={`${td} ${mono} ${i.overdue ? "text-[#c8001a]" : ""}`}>{i.expectedBack ? `${stamp12(i.expectedBack)}${i.overdue ? " · overdue" : ""}` : "—"}</td>
                <td className={`${td} ${mono}`}>{i.status === "Requested" && i.charge === 0 ? "—" : i.charge > 0 ? `₹${i.charge.toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}</td>
                <td className={`${td} text-right`}>
                  {canWrite && i.status === "Requested" && (
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { reset(); setIssuing(i); }} className={softBtn}>Issue</button>
                      <button onClick={() => cancel(i)} className="h-[30px] px-2 text-[13px] hover:underline cursor-pointer">Cancel</button>
                    </div>
                  )}
                  {canWrite && i.status === "Issued" && <button onClick={() => { reset(); setReturning(i); }} className={outlineBtn}>Return</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No requests or issues yet.</Empty>}
      </div>
      {issuing && <IssueDialog key={issuing.id} issue={issuing} onClose={() => setIssuing(null)} />}
      {returning && <ReturnDialog key={returning.id} issue={returning} onClose={() => setReturning(null)} />}
    </div>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function ShelfCell({ method, packaging, shelf }: { method: string; packaging: string; shelf: CssdShelfLifeDTO }) {
  const { run, error, reset } = useMutation();
  const effective = shelf.days[method]?.[packaging];
  const [draft, setDraft] = useState<string | null>(null);
  async function save() {
    if (draft === null) return;
    const text = draft.trim();
    setDraft(null);
    if (text === String(effective)) return;
    reset();
    await attempt(run(() => api.patch("/cssd/settings", { method, packaging, days: text === "" ? null : Number(text) })));
  }
  return (
    <div>
      <input type="number" min={1} value={draft ?? String(effective ?? "")} onChange={(e) => setDraft(e.target.value)} onBlur={save} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label={`${method} ${packaging} days`}
        className={`h-[34px] w-[88px] rounded-[8px] border bg-[color:var(--surface)] px-3 font-mono text-[14px] focus:border-[color:var(--brand)] focus:outline-none ${shelf.overridden[method]?.[packaging] ? "border-[color:var(--brand)]" : "border-[color:var(--line)]"}`} />
      {error && <span className="block text-[11px] text-[#c8001a]">{error.message}</span>}
    </div>
  );
}

export function SettingsView({ canWrite }: { canWrite: boolean }) {
  const { items: sterilizers } = useList<CssdSterilizerDTO>("/cssd/sterilizers");
  const { item: shelf } = useItem<CssdShelfLifeDTO>("/cssd/settings");
  const { run, error, reset } = useMutation();
  const [adding, setAdding] = useState(false);
  const toggle = async (s: CssdSterilizerDTO) => { reset(); await attempt(run(() => api.patch(`/cssd/sterilizers/${s.id}`, { active: !s.active }))); };
  return (
    <div className="px-5 pb-6 pt-4">
      <div className="max-w-[760px]">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[16px] font-semibold text-[color:var(--ink)]">Sterilizers</h3>
          {canWrite && <button onClick={() => setAdding(true)} className={primaryBtn}><Plus size={15} /> Add sterilizer</button>}
        </div>
        <ErrorNote message={error?.message} />
        <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
          <table className="w-full text-left">
            <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]">{["Name", "Method", "Location", "Active"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
            <tbody>
              {sterilizers.map((s) => (
                <tr key={s.id} className="border-b border-[color:var(--line)] last:border-b-0">
                  <td className={td}>{s.name}</td><td className={td}>{s.method}</td><td className={td}>{s.location || "—"}</td>
                  <td className={td}><input type="checkbox" checked={s.active} disabled={!canWrite} onChange={() => toggle(s)} aria-label={`${s.name} active`} className="h-4 w-4 accent-[color:var(--brand)]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-1 mt-8 text-[16px] font-semibold text-[color:var(--ink)]">Sterility shelf life (days)</h3>
        <p className="mb-2 text-[13px] text-[color:var(--ink-soft)]">Method × packaging; clear a cell to go back to the default. Applied when a cycle passes — sets already sterile keep their date.</p>
        {shelf && (
          <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
            <table className="w-full text-left">
              <thead><tr className="border-b border-[color:var(--line)] bg-[color:var(--faint)]"><th className={th}>Method</th>{PACKAGING.map((p) => <th key={p} className={th}>{p}</th>)}</tr></thead>
              <tbody>
                {STERILIZATION_METHODS.map((m) => (
                  <tr key={m} className="border-b border-[color:var(--line)] last:border-b-0">
                    <td className={td}>{m}</td>
                    {PACKAGING.map((p) => <td key={p} className={td}>{canWrite ? <ShelfCell method={m} packaging={p} shelf={shelf} /> : <span className={mono}>{shelf.days[m][p]}</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {adding && <SterilizerDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

