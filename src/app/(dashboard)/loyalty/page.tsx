"use client";

/**
 * Loyalty: every patient's card (Basic → Silver → Gold → Platinum → VIP), the points behind it, and who referred or is family of
 * whom, so an administrator can add points by hand where they are earned. The cards, prices and rules are in Setup → Masters.
 */
import { useEffect, useState } from "react";
import { Award, Search, Plus, Users, UserPlus, PauseCircle, BellRing } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import { TabBar } from "@/components/shared/TabBar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Stars, RankPill } from "@/components/loyalty/LoyaltyCard";
import { AdjustPointsModal, MemberDetailModal } from "@/components/loyalty/LoyaltyModals";
import type { LoyaltyLinkDTO, LoyaltyListDTO, LoyaltyMemberDTO, LoyaltyProgram } from "@/types/loyalty";
import { PatientName } from "@/components/loyalty/PatientName";

const TABS = [{ id: "members", label: "Members" }, { id: "links", label: "Referrals & family" }];
const dmy = (s: string | null) => (s ? new Date(`${s}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

const MEMBER_COLUMNS: Column[] = [
  { label: "Member", width: "minmax(160px,1.3fr)" },
  { label: "Card", width: "130px" },
  { label: "Points", width: "minmax(140px,1.2fr)" },
  { label: "Referred", width: "80px", align: "right", hideBelow: 760 },
  { label: "Family", width: "70px", align: "right", hideBelow: 700 },
  { label: "Last activity", width: "110px", hideBelow: 900 },
  { label: "", width: "110px", align: "right" },
];
const LINK_COLUMNS: Column[] = [
  { label: "Date", width: "110px", hideBelow: 700 },
  { label: "Patient", width: "minmax(140px,1fr)" },
  { label: "Link", width: "150px" },
  { label: "Linked to", width: "minmax(140px,1fr)" },
  { label: "", width: "130px", align: "right" },
];

const selectCls = "h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer";

function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Tile({ icon: Icon, value, label }: { icon: typeof Users; value: number; label: string }) {
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} flex items-center gap-3 px-4 py-3 min-w-0`}>
      <Icon size={22} strokeWidth={1.5} className="shrink-0 text-[color:var(--brand)]" />
      <div className="min-w-0"><p className="text-[20px] font-medium leading-6">{value.toLocaleString("en-IN")}</p><p className="truncate text-[12px] text-[color:var(--ink-soft)]">{label}</p></div>
    </div>
  );
}

export default function LoyaltyPage() {
  const { can, loading: authLoading } = useAuth();
  const [tab, setTab] = useState("members");
  const [search, setSearch] = useState("");
  const [rank, setRank] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [open, setOpen] = useState<number | null>(null);
  const [adjust, setAdjust] = useState<{ patientId: number; name: string; points?: number; presetPoints?: number; presetReason?: string } | null>(null);
  const q = useDebounced(search.trim());

  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (q) params.set("search", q);
  if (rank) params.set("rank", rank);
  if (status) params.set("status", status);
  const { item: list, reload } = useItem<LoyaltyListDTO>(tab === "members" ? `/loyalty/members?${params}` : null);
  const { item: links, reload: reloadLinks } = useItem<LoyaltyLinkDTO[]>(tab === "links" ? "/loyalty/links" : null);
  const { item: program } = useItem<LoyaltyProgram>("/loyalty/program");
  const [last, setLast] = useState<LoyaltyListDTO | null>(null);
  if (list && list !== last) setLast(list);
  const d = list ?? last;

  const refresh = () => { reload(); reloadLinks(); };
  /** From the inactivity alert: list exactly the patients whose cards have gone quiet. */
  const showInactive = () => { setTab("members"); setRank(""); setSearch(""); setStatus("Inactive"); setPage(1); };
  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The loyalty programme is managed by hospital administrators.</p></div>;
  const writable = can("admin", "write");
  const pages = d ? Math.max(1, Math.ceil(d.total / pageSize)) : 1;
  const rankOf = (key: string) => program?.ranks.find((r) => r.key === key);

  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 420 }}>
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--line)] px-4 sm:px-5 py-3">
          <Award size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold">Loyalty programme</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">Everyone starts on Basic and moves up with points. Prices, colours and rules are in Masters.</span>
        </div>

        {d && (
          <div className="flex flex-col gap-3 px-4 sm:px-5 pt-4">
            {d.summary.inactive > 0 && (
              <div role="alert" className="flex flex-col gap-3 rounded-[10px] border border-[#f3cf7d] bg-[#fff6dd] px-4 py-3 dark:border-[#5a4a1a] dark:bg-[#2a2412]">
                <div className="flex flex-wrap items-start gap-3">
                  <BellRing size={18} className="mt-[2px] shrink-0 text-[#b86e00] dark:text-[#ffd27a]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium text-[#7a4a00] dark:text-[#ffd27a]">
                      {d.summary.inactive} {d.summary.inactive === 1 ? "patient has" : "patients have"} had no activity in the last {d.summary.inactiveMonths} {d.summary.inactiveMonths === 1 ? "month" : "months"}
                    </p>
                    <p className="text-[12px] text-[#7a4a00]/80 dark:text-[#ffd27a]/80">No visit and no bill since then. Their cards are inactive and give no card prices until they visit or are billed again.</p>
                  </div>
                  <button onClick={showInactive} className="h-[30px] shrink-0 rounded-full border border-[#d9a441] bg-white/70 px-4 text-[12px] font-medium text-[#7a4a00] hover:bg-white cursor-pointer dark:bg-transparent dark:text-[#ffd27a]">Show them</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {d.summary.inactivePreview.map((p) => (
                    <button key={p.patientId} onClick={() => setOpen(p.patientId)} className="inline-flex max-w-full items-center gap-[6px] rounded-full border border-[#e3c27a] bg-white/70 px-3 py-[3px] text-[12px] text-[#5a3a00] hover:bg-white cursor-pointer dark:border-[#5a4a1a] dark:bg-transparent dark:text-[#ffd27a]" title={`Last activity ${dmy(p.lastActivity)}`}>
                      <span className="truncate font-medium">{p.name}</span><span className="shrink-0 opacity-75">· {Math.max(1, Math.floor(p.daysQuiet / 30.4))} mo quiet</span>
                    </button>
                  ))}
                  {d.summary.inactive > d.summary.inactivePreview.length && <span className="self-center text-[12px] text-[#7a4a00]/80 dark:text-[#ffd27a]/80">+{d.summary.inactive - d.summary.inactivePreview.length} more</span>}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {d.summary.byRank.map((r, i) => (
                <button key={r.key} onClick={() => { setRank(rank === r.key ? "" : r.key); setPage(1); setTab("members"); }} aria-pressed={rank === r.key}
                  className={`flex min-w-0 flex-col gap-1 rounded-[10px] border px-3 py-2 text-left cursor-pointer transition-colors ${rank === r.key ? "bg-[color:var(--subtle)]" : "hover:bg-[color:var(--faint)]"}`} style={{ borderColor: rank === r.key ? r.color : "var(--line)" }}>
                  <Stars filled={i + 1} color={r.color} size={12} />
                  <span className="text-[20px] font-medium leading-6">{r.count}</span>
                  <span className="truncate text-[12px] text-[color:var(--ink-soft)]">{r.name}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tile icon={Users} value={d.summary.members} label="Members" />
              <Tile icon={UserPlus} value={d.summary.referrals} label="Patients referred" />
              <Tile icon={Users} value={d.summary.families} label="With family linked" />
              <Tile icon={PauseCircle} value={d.summary.inactive} label="Inactive cards" />
            </div>
          </div>
        )}

        <div className="mt-2"><TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} /></div>

        {tab === "members" && (
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
              <label className="relative col-span-2 lg:col-span-1">
                <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
                <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, patient ID or phone…" aria-label="Search members" className={`${selectCls} pl-[34px]`} />
              </label>
              <select value={rank} onChange={(e) => { setRank(e.target.value); setPage(1); }} aria-label="Card" className={selectCls}>
                <option value="">All cards</option>{program?.ranks.map((r) => <option key={r.key} value={r.key}>{r.name}</option>)}
              </select>
              <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status" className={selectCls}>
                <option value="">Active and inactive</option><option value="Active">Active</option><option value="Inactive">Inactive</option>
              </select>
            </div>
            {!d ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading…</p> : (
              <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
                <DataTable columns={MEMBER_COLUMNS} minWidth={820}>
                  {d.members.map((m: LoyaltyMemberDTO) => {
                    const next = rankOf(m.rankKey);
                    void next;
                    return (
                      <div key={m.patientId} role="button" tabIndex={0} onClick={() => setOpen(m.patientId)} onKeyDown={(e) => e.key === "Enter" && setOpen(m.patientId)}
                        className={`${tw.table.dataRow} !h-auto py-[10px] cursor-pointer`} style={{ gridTemplateColumns: "var(--cols)" }}>
                        <div className="min-w-0"><p className="truncate text-[13px] font-medium text-[color:var(--ink)]">{m.name}</p><p className="truncate font-mono text-[11px] text-[color:var(--ink-soft)]">{m.patientCode}</p></div>
                        <div className="flex flex-col items-start gap-1"><RankPill name={m.rankName} color={m.color} /><Stars filled={m.stars} color={m.color} size={11} />{m.status === "Inactive" && <span className="text-[11px] text-[#d4000a]">Inactive</span>}</div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">{m.points}{m.manualPoints !== 0 && <span className="ml-1 text-[11px] font-normal text-[color:var(--ink-soft)]">({m.manualPoints > 0 ? "+" : ""}{m.manualPoints} by hand)</span>}</p>
                          <div className="mt-[4px] h-[5px] rounded-full bg-[color:var(--subtle-2)]"><div className="h-full rounded-full" style={{ width: `${Math.max(3, m.progress)}%`, background: m.color }} /></div>
                          <p className="mt-[2px] text-[11px] text-[color:var(--ink-soft)]">{m.next ? `${m.next.pointsNeeded} to ${m.next.name}` : "Highest card"}</p>
                        </div>
                        <span className="text-right text-[13px]">{m.referredCount}</span>
                        <span className="text-right text-[13px]">{m.familyCount}</span>
                        <span className="text-[12px] text-[color:var(--ink-soft)]">{dmy(m.lastActivity)}</span>
                        <div className="flex justify-end">
                          {writable && <button onClick={(e) => { e.stopPropagation(); setAdjust({ patientId: m.patientId, name: m.name, points: m.points }); }} className="inline-flex h-[28px] items-center gap-1 rounded-full border border-[color:var(--line)] px-3 text-[12px] hover:bg-[color:var(--subtle)] cursor-pointer"><Plus size={12} /> Points</button>}
                        </div>
                      </div>
                    );
                  })}
                </DataTable>
                {d.members.length === 0 && <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No members match.</p>}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--line)] px-4 py-3 text-[12px] text-[color:var(--ink-soft)]">
                  <span>{d.total} {d.total === 1 ? "member" : "members"}</span>
                  <div className="flex items-center gap-2">
                    <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page" className="h-[28px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 text-[12px]">{[25, 50, 100].map((n) => <option key={n} value={n}>{n} a page</option>)}</select>
                    <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-[28px] rounded-[8px] border border-[color:var(--line)] px-3 disabled:opacity-40 cursor-pointer">Previous</button>
                    <span>{page} / {pages}</span>
                    <button disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="h-[28px] rounded-[8px] border border-[color:var(--line)] px-3 disabled:opacity-40 cursor-pointer">Next</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "links" && (
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            <p className="text-[13px] text-[color:var(--ink-soft)]">Every &ldquo;referred by&rdquo; and &ldquo;family of&rdquo; the front desk and doctors recorded on an appointment. Award points to the person who referred or brought the family.</p>
            {!links ? <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">Loading…</p> : links.length === 0 ? (
              <p className={`${tw.surface.card} ${tw.radius.card} py-10 text-center text-[13px] text-[color:var(--ink-soft)]`}>Nothing recorded yet. Add &ldquo;referred by&rdquo; or &ldquo;family of&rdquo; when booking or editing an appointment.</p>
            ) : (
              <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
                <DataTable columns={LINK_COLUMNS} minWidth={760}>
                  {links.map((l) => (
                    <div key={`${l.kind}-${l.patientId}-${l.otherId}`} className={`${tw.table.dataRow} !h-auto py-[10px]`} style={{ gridTemplateColumns: "var(--cols)" }}>
                      <span className="text-[12px] text-[color:var(--ink-soft)]">{dmy(l.date)}</span>
                      <span className="min-w-0 truncate text-[13px] font-medium"><PatientName id={l.patientId} name={l.patientName} /></span>
                      <span className="text-[13px]">{l.kind === "referral" ? "Referred by" : `Family of${l.relation ? ` (${l.relation})` : ""}`}</span>
                      <span className="min-w-0 truncate text-[13px] font-medium">{l.otherName}</span>
                      <div className="flex justify-end">
                        {writable && (
                          <button
                            onClick={() => setAdjust({ patientId: l.otherId, name: l.otherName, presetPoints: l.kind === "referral" ? program?.scoring.perReferral.points : program?.scoring.perFamilyMember.points, presetReason: l.kind === "referral" ? `Referred ${l.patientName}` : `Family member ${l.patientName} joined` })}
                            className="inline-flex h-[28px] items-center gap-1 rounded-full border border-[color:var(--line)] px-3 text-[12px] hover:bg-[color:var(--subtle)] cursor-pointer"><Plus size={12} /> Award points</button>
                        )}
                      </div>
                    </div>
                  ))}
                </DataTable>
              </div>
            )}
          </div>
        )}
      </div>

      {open !== null && <MemberDetailModal patientId={open} onClose={() => setOpen(null)} onChanged={refresh} />}
      {adjust && <AdjustPointsModal {...adjust} onClose={() => setAdjust(null)} onSaved={refresh} />}
    </div>
  );
}
