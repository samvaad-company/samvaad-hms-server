"use client";

/**
 * The AI section for super admins and admins, in three tabs:
 *   Overview       what the whole staff has used this month, person by person
 *   Analytics      where the tokens go: trend, roles, heaviest users, input vs output, the month's projection
 *   Access & limits  the default limit, one person's limit, pausing or resuming someone, and giving extra tokens
 * The allowance renews on the 1st of each month.
 */
import { useEffect, useState } from "react";
import { Zap, MessageSquare, Users, AlertTriangle, Gauge, RefreshCw, Plus, Loader2, PauseCircle, PlayCircle, TrendingUp, CalendarDays, ArrowDownUp } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { TabBar } from "@/components/shared/TabBar";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import type { AiUsageDTO, AiUsageUserDTO, AiUsageStatus } from "@/types/api";

const fmt = (n: number) => n.toLocaleString("en-IN");
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n));
const monthLabel = (m: string) => new Date(`${m}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "—");

const STATUS: Record<AiUsageStatus, { label: string; cls: string }> = {
  ok: { label: "Within limit", cls: "bg-[#dffff3] text-[#00955c] dark:bg-[#12332a] dark:text-[#5fe0ad]" },
  near: { label: "Running low", cls: "bg-[#fff2e0] text-[#c26a00] dark:bg-[#3a2a12] dark:text-[#ffb54d]" },
  exceeded: { label: "Limit reached", cls: "bg-[#ffe9e9] text-[#d4000a] dark:bg-[#3a1d1f] dark:text-[#ff9a9d]" },
  blocked: { label: "Paused", cls: "bg-[#ffe9e9] text-[#d4000a] dark:bg-[#3a1d1f] dark:text-[#ff9a9d]" },
  unlimited: { label: "No limit", cls: "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]" },
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "analytics", label: "Analytics" },
  { id: "access", label: "Access & limits" },
];

const USAGE_COLUMNS: Column[] = [
  { label: "Employee", width: "minmax(150px,1.2fr)" },
  { label: "Role", width: "120px", hideBelow: 760 },
  { label: "Questions", width: "90px", align: "right", hideBelow: 680 },
  { label: "Tokens used", width: "minmax(150px,1.3fr)" },
  { label: "Limit", width: "110px", align: "right" },
  { label: "Status", width: "120px" },
];

const ACCESS_COLUMNS: Column[] = [
  { label: "Employee", width: "minmax(150px,1.2fr)" },
  { label: "Role", width: "110px", hideBelow: 860 },
  { label: "Tokens used", width: "minmax(130px,1.1fr)" },
  { label: "Limit", width: "100px", align: "right" },
  { label: "Status", width: "110px" },
  { label: "", width: "270px", align: "right" },
];

function Tile({ icon: Icon, value, label, tone }: { icon: typeof Zap; value: string; label: string; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-[#d4000a]" : tone === "warn" ? "text-[#c26a00]" : "text-[color:var(--brand)]";
  return (
    <div className={`${tw.surface.card} ${tw.radius.card} px-4 py-3 flex items-center gap-3 min-w-0`}>
      <Icon size={22} strokeWidth={1.5} className={`${color} shrink-0`} />
      <div className="min-w-0">
        <p className="text-[20px] font-medium leading-6 text-[color:var(--ink)] truncate">{value}</p>
        <p className="text-[12px] text-[color:var(--ink-soft)] truncate">{label}</p>
      </div>
    </div>
  );
}

function UsageBar({ used, limit, status }: { used: number; limit: number | null; status: AiUsageStatus }) {
  const share = limit ? Math.min(1, used / Math.max(1, limit)) : 0;
  const color = status === "exceeded" || status === "blocked" ? "bg-[#ff4d4f]" : status === "near" ? "bg-[#ff9000]" : "bg-[color:var(--brand)]";
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-[color:var(--ink)]">{fmt(used)}</p>
      {limit != null && (
        <div className="mt-[4px] h-[5px] w-full rounded-full bg-[color:var(--subtle-2)] overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${used > 0 ? Math.max(3, share * 100) : 0}%` }} />
        </div>
      )}
    </div>
  );
}

const StatusPill = ({ status }: { status: AiUsageStatus }) => (
  <span><span className={`inline-block text-[11px] px-[10px] py-[3px] rounded-full whitespace-nowrap ${STATUS[status].cls}`}>{STATUS[status].label}</span></span>
);

const LimitCell = ({ u }: { u: AiUsageUserDTO }) => (
  <span className="text-[13px] text-[color:var(--ink)] text-right">
    {u.limit == null ? "No limit" : fmt(u.limit)}
    {u.extraGranted > 0 && <span className="block text-[10px] text-[color:var(--brand)]">incl. +{compact(u.extraGranted)} extra</span>}
    {u.ownLimit != null && u.extraGranted === 0 && <span className="block text-[10px] text-[color:var(--ink-soft)]">own limit</span>}
  </span>
);

const btn = "text-[12px] font-normal rounded-full px-3 py-[5px] border transition-colors cursor-pointer whitespace-nowrap";
const plainBtn = `${btn} border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`;

export function AiUsageView() {
  const [tab, setTab] = useState("overview");
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [data, setData] = useState<AiUsageDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    api
      .get<AiUsageDTO>("/admin/ai-usage", month ? { month } : undefined)
      .then((d) => { if (alive) { setData(d); setError(null); } })
      .catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [month, tick]);

  const reload = () => setTick((n) => n + 1);

  if (error) {
    // The API answers "No route" until the server with the AI usage endpoints has been deployed.
    const notDeployed = /no route/i.test(error);
    return (
      <div className={`${tw.surface.card} ${tw.radius.card} p-6 flex flex-col gap-2`}>
        <p className="text-[14px] font-medium text-[color:var(--ink)]">{notDeployed ? "The AI usage service isn't available on this server yet" : "Couldn't load AI usage"}</p>
        <p className="text-[13px] text-[color:var(--ink-soft)]">
          {notDeployed
            ? "The server you are connected to needs the latest update (including database migration 0054_ai_token_usage). Once it is deployed, this page will show staff token use, analytics and access controls."
            : error}
        </p>
        <div><button onClick={reload} className={`${plainBtn} mt-1`}>Try again</button></div>
      </div>
    );
  }
  if (!data) return <div className="p-10 flex items-center justify-center gap-2 text-[13px] text-[color:var(--ink-soft)]"><Loader2 size={16} className="animate-spin" /> Loading usage…</div>;

  const current = data.months[0];
  const isCurrent = data.month === current;

  return (
    <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
      <TabBar
        tabs={TABS}
        activeTab={tab}
        onTabChange={setTab}
        trailing={
          <div className="flex items-center gap-2">
            <select
              value={data.month}
              onChange={(e) => setMonth(e.target.value === current ? undefined : e.target.value)}
              aria-label="Month"
              className="h-[34px] rounded-full bg-[color:var(--surface)] border border-[color:var(--line)] px-3 text-[13px] text-[color:var(--ink)] focus:outline-none focus:border-[color:var(--brand)] cursor-pointer"
            >
              {data.months.map((m) => <option key={m} value={m}>{monthLabel(m)}{m === current ? " (this month)" : ""}</option>)}
            </select>
            <button onClick={reload} aria-label="Refresh" title="Refresh" className="w-[34px] h-[34px] rounded-full border border-[color:var(--line)] flex items-center justify-center text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">
              <RefreshCw size={14} />
            </button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 flex flex-col gap-5">
        <p className="text-[12px] text-[color:var(--ink-soft)]">
          Every question costs tokens. Each person has a monthly allowance that renews on {new Date(`${data.renewsOn}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.
        </p>
        {tab === "overview" && <Overview data={data} />}
        {tab === "analytics" && <Analytics data={data} />}
        {tab === "access" && <Access data={data} isCurrent={isCurrent} reload={reload} />}
      </div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ data }: { data: AiUsageDTO }) {
  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Tile icon={Zap} value={compact(data.totals.used)} label="Tokens used by staff" />
        <Tile icon={MessageSquare} value={fmt(data.totals.messages)} label="AI answers" />
        <Tile icon={Users} value={fmt(data.totals.activeUsers)} label="People using AI" />
        <Tile icon={Gauge} value={fmt(data.totals.near)} label="Running low" tone={data.totals.near ? "warn" : undefined} />
        <Tile icon={AlertTriangle} value={fmt(data.totals.exceeded + data.totals.blocked)} label="Stopped (limit or paused)" tone={data.totals.exceeded + data.totals.blocked ? "bad" : undefined} />
      </div>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[color:var(--line)]">
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Tokens used by each staff member</p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">Heaviest first. To pause someone or give them more tokens, use Access &amp; limits.</p>
        </div>
        <DataTable columns={USAGE_COLUMNS} minWidth={760}>
          {data.users.map((u) => (
            <div key={u.userId} className={`${tw.table.dataRow} !h-auto py-[10px]`} style={{ gridTemplateColumns: "var(--cols)" }}>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[color:var(--ink)] truncate">{u.name}</p>
                <p className="text-[11px] text-[color:var(--ink-soft)] truncate">Last used {when(u.lastUsedAt)}</p>
              </div>
              <span className="text-[13px] text-[color:var(--ink-soft)] truncate">{u.role}</span>
              <span className="text-[13px] text-[color:var(--ink)] text-right">{fmt(u.messages)}</span>
              <UsageBar used={u.used} limit={u.limit} status={u.status} />
              <LimitCell u={u} />
              <StatusPill status={u.status} />
            </div>
          ))}
        </DataTable>
        {data.users.length === 0 && <p className="py-10 text-center text-[13px] text-[color:var(--ink-soft)]">No staff yet.</p>}
      </div>
    </>
  );
}

// ── Analytics ────────────────────────────────────────────────────────────────

function Analytics({ data }: { data: AiUsageDTO }) {
  const t = data.totals;
  const maxDay = Math.max(1, ...data.daily.map((d) => d.tokens));
  const maxRole = Math.max(1, ...data.byRole.map((r) => r.used));
  const inShare = t.used > 0 ? Math.round((t.promptTokens / Math.max(1, t.promptTokens + t.outputTokens)) * 100) : 0;
  const top = data.users.filter((u) => u.used > 0).slice(0, 5);

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile icon={Zap} value={compact(t.used)} label="Total tokens" />
        <Tile icon={ArrowDownUp} value={t.avgPerAnswer ? fmt(t.avgPerAnswer) : "—"} label="Avg tokens per answer" />
        <Tile icon={CalendarDays} value={t.peakDay ? compact(t.peakDay.tokens) : "—"} label={t.peakDay ? `Busiest day · ${dayLabel(t.peakDay.date)}` : "Busiest day"} />
        <Tile icon={TrendingUp} value={t.projected != null ? compact(t.projected) : "—"} label="On track for this month" tone={t.projected != null && t.projected > t.used * 2 ? "warn" : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className={`${tw.surface.card} ${tw.radius.card} p-4 lg:col-span-2 min-w-0`}>
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Tokens per day · {monthLabel(data.month)}</p>
          <div className="mt-3 h-[140px] flex items-end gap-[3px]" role="img" aria-label="Tokens used each day">
            {data.daily.map((d) => (
              <div key={d.date} className="flex-1 min-w-0 flex flex-col justify-end h-full" title={`${dayLabel(d.date)}: ${fmt(d.tokens)} tokens, ${d.messages} answers`}>
                <div className="w-full rounded-t-[3px] bg-[color:var(--brand)]" style={{ height: d.tokens ? `${Math.max(4, (d.tokens / maxDay) * 100)}%` : "2px", opacity: d.tokens ? 1 : 0.2 }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-[color:var(--ink-soft)]"><span>1</span><span>{data.daily.length}</span></div>
        </div>

        <div className={`${tw.surface.card} ${tw.radius.card} p-4 min-w-0`}>
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Input vs output</p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">What was sent to the AI against what it wrote back.</p>
          <div className="mt-3 h-[10px] rounded-full overflow-hidden bg-[color:var(--subtle-2)] flex">
            <div className="h-full bg-[color:var(--brand)]" style={{ width: `${inShare}%` }} />
            <div className="h-full bg-[#ff9000]" style={{ width: `${t.used > 0 ? 100 - inShare : 0}%` }} />
          </div>
          <div className="mt-3 flex flex-col gap-1 text-[12px]">
            <span className="flex items-center gap-2"><i className="w-2 h-2 rounded-full bg-[color:var(--brand)]" /> Input <b className="ml-auto font-medium text-[color:var(--ink)]">{fmt(t.promptTokens)}</b></span>
            <span className="flex items-center gap-2"><i className="w-2 h-2 rounded-full bg-[#ff9000]" /> Output <b className="ml-auto font-medium text-[color:var(--ink)]">{fmt(t.outputTokens)}</b></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className={`${tw.surface.card} ${tw.radius.card} p-4 min-w-0`}>
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Use by role</p>
          <div className="mt-3 flex flex-col gap-3">
            {data.byRole.length === 0 && <p className="text-[12px] text-[color:var(--ink-soft)]">No AI use this month.</p>}
            {data.byRole.slice(0, 8).map((r) => (
              <div key={r.role}>
                <div className="flex justify-between gap-2 text-[12px]"><span className="truncate text-[color:var(--ink)]">{r.role}</span><span className="text-[color:var(--ink-soft)] shrink-0">{compact(r.used)} · {r.users} {r.users === 1 ? "person" : "people"}</span></div>
                <div className="mt-[3px] h-[5px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${Math.max(3, (r.used / maxRole) * 100)}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className={`${tw.surface.card} ${tw.radius.card} p-4 min-w-0`}>
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Heaviest users</p>
          <ol className="mt-3 flex flex-col gap-3">
            {top.length === 0 && <li className="text-[12px] text-[color:var(--ink-soft)]">No AI use this month.</li>}
            {top.map((u, i) => (
              <li key={u.userId} className="flex items-center gap-3">
                <span className="w-5 text-[12px] text-[color:var(--ink-soft)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-[color:var(--ink)] truncate">{u.name} <span className="text-[11px] text-[color:var(--ink-soft)]">· {u.role}</span></p>
                  <div className="mt-[3px] h-[5px] rounded-full bg-[color:var(--subtle-2)] overflow-hidden"><div className="h-full rounded-full bg-[color:var(--brand)]" style={{ width: `${Math.max(3, (u.used / Math.max(1, top[0].used)) * 100)}%` }} /></div>
                </div>
                <span className="text-[12px] text-[color:var(--ink)] text-right shrink-0">{compact(u.used)}<span className="block text-[10px] text-[color:var(--ink-soft)]">{t.used ? Math.round((u.used / t.used) * 100) : 0}% of all</span></span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

// ── Access & limits ──────────────────────────────────────────────────────────

function Access({ data, isCurrent, reload }: { data: AiUsageDTO; isCurrent: boolean; reload: () => void }) {
  const [limitFor, setLimitFor] = useState<AiUsageUserDTO | null>(null);
  const [grantFor, setGrantFor] = useState<AiUsageUserDTO | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<string | null>(null);
  const save = useMutation();
  const toggle = useMutation();

  async function saveDefault() {
    if (defaultDraft == null) return;
    await save.run(() => api.put("/admin/ai-usage/limits", { limit: Number(defaultDraft) }));
    setDefaultDraft(null);
    reload();
  }
  async function setBlocked(u: AiUsageUserDTO, blocked: boolean) {
    await toggle.run(() => api.put("/admin/ai-usage/access", { userId: u.userId, blocked }));
    reload();
  }

  return (
    <>
      <div className={`${tw.surface.card} ${tw.radius.card} p-4 flex flex-wrap items-end gap-3`}>
        <div className="min-w-[200px] flex-1">
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Monthly limit for each person</p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">The default for everyone. Set a different limit for one person below. Super admins are not limited.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-[160px]">
            <FormRow label="Tokens a month">
              <FormInput type="number" min="0" value={defaultDraft ?? String(data.defaultLimit)} onChange={setDefaultDraft} />
            </FormRow>
          </div>
          <button
            onClick={saveDefault}
            disabled={defaultDraft == null || save.loading}
            className="h-[42px] px-5 rounded-full bg-[color:var(--brand)] text-white text-[13px] hover:bg-[color:var(--brand-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {save.loading ? "Saving…" : "Save"}
          </button>
        </div>
        {save.error && <p className="w-full text-[12px] text-[#d4000a]">{save.error.message}</p>}
      </div>

      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
        <div className="px-4 py-3 border-b border-[color:var(--line)]">
          <p className="text-[13px] font-medium text-[color:var(--ink)]">Who can use AI</p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">
            Pause anyone to stop their AI use at once, and resume them when ready. {isCurrent ? "Give extra tokens to anyone who has reached their limit." : "Extra tokens can only be given for the current month."}
          </p>
          {toggle.error && <p className="mt-1 text-[12px] text-[#d4000a]">{toggle.error.message}</p>}
        </div>
        <DataTable columns={ACCESS_COLUMNS} minWidth={800}>
          {data.users.map((u) => (
            <div key={u.userId} className={`${tw.table.dataRow} !h-auto py-[10px]`} style={{ gridTemplateColumns: "var(--cols)" }}>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[color:var(--ink)] truncate">{u.name}</p>
                <p className="text-[11px] text-[color:var(--ink-soft)] truncate">Last used {when(u.lastUsedAt)}</p>
              </div>
              <span className="text-[13px] text-[color:var(--ink-soft)] truncate">{u.role}</span>
              <UsageBar used={u.used} limit={u.limit} status={u.status} />
              <LimitCell u={u} />
              <StatusPill status={u.status} />
              <div className="flex flex-wrap justify-end gap-2">
                {u.status !== "unlimited" && (
                  <>
                    {u.blocked ? (
                      <button onClick={() => setBlocked(u, false)} disabled={toggle.loading} className={`${btn} inline-flex items-center gap-1 bg-[color:var(--brand)] text-white border-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]`}>
                        <PlayCircle size={12} /> Resume
                      </button>
                    ) : (
                      <button onClick={() => setBlocked(u, true)} disabled={toggle.loading} className={`${btn} inline-flex items-center gap-1 border-[#ffc8c8] text-[#d4000a] hover:bg-[#ffe9e9] dark:hover:bg-[#3a1d1f]`}>
                        <PauseCircle size={12} /> Pause
                      </button>
                    )}
                    <button onClick={() => setLimitFor(u)} className={plainBtn}>Limit</button>
                    {isCurrent && (
                      <button onClick={() => setGrantFor(u)} className={`${btn} inline-flex items-center gap-1 ${u.status === "exceeded" ? "bg-[color:var(--brand)] text-white border-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                        <Plus size={12} /> Tokens
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </DataTable>
      </div>

      <div className={`${tw.surface.card} ${tw.radius.card} p-4`}>
        <p className="text-[13px] font-medium text-[color:var(--ink)]">Extra tokens given · {monthLabel(data.month)}</p>
        {data.grants.length === 0 ? (
          <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">None this month.</p>
        ) : (
          <ul className="mt-2 divide-y divide-[color:var(--line)]">
            {data.grants.map((g) => (
              <li key={g.id} className="py-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[13px]">
                <span className="font-medium text-[color:var(--ink)]">{g.userName}</span>
                <span className="text-[color:var(--brand)]">+{fmt(g.tokens)} tokens</span>
                {g.note && <span className="text-[color:var(--ink-soft)]">“{g.note}”</span>}
                <span className="ml-auto text-[11px] text-[color:var(--ink-soft)]">by {g.grantedBy} · {when(g.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {limitFor && <LimitModal user={limitFor} defaultLimit={data.defaultLimit} onClose={() => setLimitFor(null)} onSaved={reload} />}
      {grantFor && <GrantModal user={grantFor} onClose={() => setGrantFor(null)} onSaved={reload} />}
    </>
  );
}

function ModalFooter({ onClose, onSave, loading, label, extra }: { onClose: () => void; onSave: () => void; loading: boolean; label: string; extra?: React.ReactNode }) {
  return (
    <>
      {extra}
      <button onClick={onClose} className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors">Cancel</button>
      <button onClick={onSave} disabled={loading} className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
        {loading ? "Saving…" : label}
      </button>
    </>
  );
}

function LimitModal({ user, defaultLimit, onClose, onSaved }: { user: AiUsageUserDTO; defaultLimit: number; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [value, setValue] = useState(String(user.ownLimit ?? defaultLimit));

  async function save(limit: number | null) {
    await run(() => api.put("/admin/ai-usage/limits", { userId: user.userId, limit }));
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Monthly limit — ${user.name}`}
      subtitle={`${user.role} · used ${fmt(user.used)} tokens so far this month`}
      width={440}
      footer={
        <ModalFooter
          onClose={onClose}
          onSave={() => save(Number(value))}
          loading={loading}
          label="Save limit"
          extra={user.ownLimit != null ? <button onClick={() => save(null)} disabled={loading} className="mr-auto text-[12px] text-[color:var(--ink-soft)] underline cursor-pointer">Use the default ({fmt(defaultLimit)})</button> : undefined}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <FormRow label="Tokens a month" hint={`The default for everyone is ${fmt(defaultLimit)}.`}>
          <FormInput type="number" min="0" value={value} onChange={setValue} />
        </FormRow>
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

function GrantModal({ user, onClose, onSaved }: { user: AiUsageUserDTO; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [tokens, setTokens] = useState("50000");
  const [note, setNote] = useState("");

  async function save() {
    await run(() => api.post("/admin/ai-usage/grants", { userId: user.userId, tokens: Number(tokens), note }));
    onSaved();
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Give more tokens — ${user.name}`}
      subtitle={`This month: ${fmt(user.used)} used of ${user.limit == null ? "no limit" : fmt(user.limit)}. The extra tokens count for this month only.`}
      width={460}
      footer={<ModalFooter onClose={onClose} onSave={save} loading={loading} label="Give tokens" />}
    >
      <div className="flex flex-col gap-4">
        <FormRow label="Extra tokens">
          <FormInput type="number" min="1" value={tokens} onChange={setTokens} />
        </FormRow>
        <div className="flex flex-wrap gap-2">
          {[25_000, 50_000, 100_000, 250_000].map((n) => (
            <button key={n} type="button" onClick={() => setTokens(String(n))} className={`${btn} ${tokens === String(n) ? "bg-[color:var(--brand-soft)] border-[color:var(--brand)] text-[color:var(--brand)]" : "border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
              +{compact(n)}
            </button>
          ))}
        </div>
        <FormRow label="Note (optional)" hint="Why the extra tokens were given.">
          <FormInput value={note} onChange={setNote} placeholder="e.g. month-end reports" />
        </FormRow>
        {error && <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}
