"use client";

/**
 * Roles & access: for each role, what it may do in each part of the app: nothing, read only, add, add & edit, or full (with delete).
 * Only the hospital's Super Admin can change it; other admin-panel users see it read-only. The server enforces every level.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { ACCESS_HELP, ACCESS_LABEL, type AccessLevel, type RoleAccessDTO } from "@/types/role-access";

const LABELS: Record<string, string> = {
  patients: "Patients", appointments: "Appointments", doctors: "Doctors", opd: "OPD", prescriptions: "Prescriptions", ipd: "IPD (inpatients)",
  nursing: "Nurse station", ot: "Operation theatre", beds: "Beds & wards", followups: "Follow-ups", teleconsult: "Video consults", scribe: "AI scribe",
  records: "Records", consents: "Consents & signatures", lab: "Lab", radiology: "Radiology", bloodbank: "Blood bank", pharmacy: "Pharmacy",
  inventory: "Inventory", ambulance: "Ambulance", cssd: "CSSD", mrd: "MRD & file tracking", documents: "Documents", billing: "Billing",
  tpa: "TPA, insurance & pre-auth", finance: "Finance", reports: "Reports", staff: "Staff directory", hr: "HR", payroll: "Payroll",
  attendance: "Attendance", admin: "Admin panel & setup", tasks: "Task board", chat: "AI assistant", enquiries: "Enquiries", awareness: "Awareness programmes", casefile: "IPD case files",
};
const GROUPS: { title: string; items: string[] }[] = [
  { title: "Patients & care", items: ["casefile", "patients", "appointments", "doctors", "opd", "prescriptions", "ipd", "nursing", "ot", "beds", "followups", "teleconsult", "scribe", "records", "consents"] },
  { title: "Diagnostics & services", items: ["lab", "radiology", "bloodbank", "pharmacy", "inventory", "ambulance", "cssd", "mrd", "documents"] },
  { title: "Billing & finance", items: ["billing", "tpa", "finance", "reports"] },
  { title: "People", items: ["staff", "hr", "payroll", "attendance"] },
  { title: "Admin & other", items: ["admin", "tasks", "chat", "enquiries", "awareness"] },
];

const SHADE: Record<AccessLevel, string> = {
  none: "text-[#8a8f98]", read: "text-[color:var(--ink)]", add: "text-[#0a5fc4]", edit: "text-[#7a4a00]", write: "text-[#0b7a47]",
};

export default function RolesPage() {
  const { user } = useAuth();
  const canChange = user?.role === "Super Admin";
  const { item, loading, error, reload } = useItem<RoleAccessDTO>("/admin/role-access");
  const { run, loading: saving, error: saveError, reset } = useMutation();
  const [role, setRole] = useState("");
  const [draft, setDraft] = useState<Record<string, AccessLevel>>({});
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);

  const roles = item?.roles ?? [];
  const current = roles.find((r) => r.role === role) ?? null;
  // Open the first role that can be changed, and reload the draft whenever the role or the saved levels change.
  useEffect(() => { if (!role && roles.length) setRole((roles.find((r) => !r.locked) ?? roles[0]).role); }, [roles, role]);
  useEffect(() => { setDraft(current ? { ...current.current } : {}); setSaved(false); reset(); }, [current, reset]);

  const dirty = useMemo(() => !!current && Object.keys(draft).some((k) => draft[k] !== current.current[k]), [draft, current]);
  const q = search.trim().toLowerCase();
  const visible = (key: string) => !q || (LABELS[key] ?? key).toLowerCase().includes(q);

  const save = async () => {
    if (!current) return;
    try { await run(() => api.put("/admin/role-access", { role: current.role, levels: draft })); setSaved(true); reload(); } catch { /* shown below */ }
  };
  const resetRole = async () => {
    if (!current || !confirm(`Put ${current.role} back to the standard access? Your changes for this role will be removed.`)) return;
    try { await run(() => api.put("/admin/role-access", { role: current.role, reset: true })); reload(); } catch { /* shown below */ }
  };

  const known = new Set(GROUPS.flatMap((g) => g.items));
  const groups = [...GROUPS, { title: "Other", items: (item?.resources ?? []).filter((r) => !known.has(r)) }].filter((g) => g.items.some((k) => (item?.resources ?? []).includes(k) && visible(k)));

  return (
    <>
      <PageHeader title="Roles & access" subtitle="Choose what each role can see and do. Changes apply to everyone with that role at their next page load."
        stats={[{ icon: ShieldCheck, value: String(roles.filter((r) => r.changed > 0).length), label: "Roles customised" }]} dateRange={false} />

      <div className={`${tw.gutterX} mb-[30px] flex flex-col gap-4`}>
        {!canChange && <p className="rounded-[8px] bg-[#fff6dd] px-3 py-2 text-[13px] text-[#7a4a00]">Only the hospital&apos;s admin can change access. You can look but not edit.</p>}

        <div className={`${tw.surface.card} ${tw.radius.card} grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5`}>
          {(Object.keys(ACCESS_LABEL) as AccessLevel[]).map((l) => (
            <div key={l}><p className={`text-[13px] font-medium ${SHADE[l]}`}>{ACCESS_LABEL[l]}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{ACCESS_HELP[l]}</p></div>
          ))}
        </div>

        {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
        {loading && !item && <p className="py-10 text-center text-[14px] text-[color:var(--ink-soft)]">Loading…</p>}

        {item && (
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className={`${tw.surface.card} ${tw.radius.card} flex flex-row gap-1 overflow-x-auto p-2 lg:flex-col lg:overflow-visible`} role="tablist" aria-label="Roles">
              {roles.map((r) => (
                <button key={r.role} role="tab" aria-selected={r.role === role} onClick={() => setRole(r.role)}
                  className={`flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-[8px] px-3 py-[9px] text-left text-[13px] ${r.role === role ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                  <span className="whitespace-nowrap">{r.role}</span>
                  {r.locked ? <span className="rounded-full bg-[color:var(--subtle)] px-2 text-[11px] text-[color:var(--ink-soft)]">Always full</span>
                    : r.changed > 0 ? <span className="rounded-full bg-[#fff6dd] px-2 text-[11px] text-[#7a4a00]">{r.changed} changed</span> : null}
                </button>
              ))}
            </div>

            {current && (
              <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
                <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] p-4">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-[16px] font-medium text-[color:var(--ink)]">{current.role}</p>
                    <p className="text-[12px] text-[color:var(--ink-soft)]">{current.locked ? "The hospital's own admin always has full access, so this can't be changed." : "Pick a level for each part of the app."}</p>
                  </div>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a part of the app…" aria-label="Find a part of the app"
                      className="h-[36px] w-[210px] rounded-full border border-[color:var(--line)] bg-[color:var(--subtle)] pl-8 pr-3 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
                  </div>
                  {canChange && !current.locked && (
                    <>
                      <button onClick={resetRole} disabled={saving || current.changed === 0} className="inline-flex h-[34px] cursor-pointer items-center gap-1 rounded-full border border-[color:var(--line)] px-4 text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] disabled:cursor-default disabled:opacity-50"><RotateCcw size={13} /> Standard access</button>
                      <button onClick={save} disabled={saving || !dirty} className="inline-flex h-[34px] cursor-pointer items-center rounded-full bg-[color:var(--brand)] px-5 text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:cursor-default disabled:opacity-50">{saving ? "Saving…" : saved && !dirty ? "Saved" : "Save changes"}</button>
                    </>
                  )}
                </div>
                {saveError && <p className="mx-4 mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{saveError.message}</p>}

                <div className="max-h-[70vh] overflow-y-auto">
                  {groups.length === 0 && <p className="py-10 text-center text-[14px] text-[color:var(--ink-soft)]">Nothing matches.</p>}
                  {groups.map((g) => (
                    <div key={g.title}>
                      <p className="sticky top-0 z-[1] bg-[color:var(--subtle)] px-4 py-[6px] text-[12px] font-medium uppercase tracking-wide text-[color:var(--ink-soft)]">{g.title}</p>
                      {g.items.filter((k) => item.resources.includes(k) && visible(k)).map((k) => {
                        const level = draft[k] ?? current.current[k], base = current.defaults[k], edited = level !== base;
                        return (
                          <div key={k} className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--subtle-2)] pl-4 pr-7 py-[8px]">
                            <div className="min-w-[160px]">
                              <p className="text-[14px] text-[color:var(--ink)]">{LABELS[k] ?? k}</p>
                              {edited && <p className="text-[11px] text-[#7a4a00]">Standard: {ACCESS_LABEL[base]}</p>}
                            </div>
                            <div className="relative w-[190px]">
                            <select value={level} disabled={!canChange || current.locked} aria-label={`${current.role}: ${LABELS[k] ?? k}`}
                              onChange={(e) => { setSaved(false); setDraft((d) => ({ ...d, [k]: e.target.value as AccessLevel })); }}
                              className={`h-[36px] w-full appearance-none rounded-[8px] border bg-[color:var(--surface)] pl-3 pr-9 text-[13px] focus:border-[color:var(--brand)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${edited ? "border-[#e3c27a]" : "border-[color:var(--line)]"} ${SHADE[level]}`}>
                              {item.levels.map((l) => <option key={l} value={l}>{ACCESS_LABEL[l]}</option>)}
                            </select>
                            <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
