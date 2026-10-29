"use client";

/** HR overview: headcount, leave waiting and today, licences running out, today's duty, and the latest payroll. */
import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useItem } from "@/lib/api/hooks";
import type { HrOverviewDTO } from "@/types/api";
import { dmy, Empty, MrdShell, Pill, StatCard, StatGrid, softBtn } from "@/components/mrd/shared";
import { monthLabel, rupees } from "@/components/hr/shared";

function Panel({ title, href, action, children }: { title: string; href?: string; action?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)]">
      <header className="flex items-center gap-2 border-b border-[color:var(--line)] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[color:var(--ink)]">{title}</h2>
        {href && action && <Link href={href} className={softBtn + " ml-auto"}>{action}</Link>}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}
const none = (text: string) => <p className="py-2 text-[13px] text-[color:var(--ink-soft)]">{text}</p>;

export default function HrOverviewPage() {
  const { can } = useAuth();
  const { item: o, loading } = useItem<HrOverviewDTO>("/hr/overview");
  const showPayroll = can("payroll");
  return (
    <MrdShell icon={<BriefcaseBusiness size={16} />} title="HR" note={o ? `Today, ${dmy(o.today)}` : undefined}
      right={<Link href="/staff" className={softBtn + " !h-[36px]"}>Staff directory</Link>}>
      {!o ? <Empty>{loading ? "Loading…" : "The HR overview could not be loaded."}</Empty> : (
        <>
          <StatGrid cols={4}>
            <StatCard label="Staff on the books" value={o.staff.total} />
            <StatCard label="Working today" value={o.staff.active} />
            <StatCard label="On leave today" value={o.staff.onLeave} />
            <StatCard label="Leave awaiting a decision" value={o.pendingLeave} />
          </StatGrid>
          <div className="grid gap-4 px-5 pb-5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
            <Panel title="Leave waiting & today" href="/hr/leave" action="Open leave">
              {o.pendingLeave > 0 && <p className="mb-2 rounded-[8px] bg-[#fff2d6] px-3 py-2 text-[13px] text-[#8a5300]">{o.pendingLeave} {o.pendingLeave === 1 ? "request is" : "requests are"} waiting for approval.</p>}
              {o.leaveToday.length === 0 ? none("No one is on approved leave today.") : (
                <ul className="text-[14px]">{o.leaveToday.map((l) => <li key={l.staffId} className="flex justify-between gap-2 py-[3px]"><Link href={`/staff/${l.staffId}`} className="hover:underline">{l.name}</Link><span className="text-[12px] text-[color:var(--ink-soft)]">{l.role} · {l.code}</span></li>)}</ul>
              )}
            </Panel>
            <Panel title="Licences to renew" href="/staff" action="Staff">
              {o.licences.length === 0 ? none("No licence is lapsed or about to lapse.") : (
                <ul className="text-[14px]">
                  {o.licences.map((l) => (
                    <li key={l.staffId} className="flex items-center justify-between gap-2 py-[3px]">
                      <Link href={`/staff/${l.staffId}`} className="min-w-0 truncate hover:underline">{l.name} <span className="text-[12px] text-[color:var(--ink-soft)]">{l.licenceNo}</span></Link>
                      <Pill tone={l.daysLeft < 0 ? "red" : l.daysLeft <= 30 ? "amber" : "plain"}>{l.daysLeft < 0 ? `Lapsed ${-l.daysLeft}d ago` : l.daysLeft === 0 ? "Lapses today" : `${l.daysLeft}d left`}</Pill>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel title="On duty today" href="/hr/roster" action="Open roster">
              {o.roster.length === 0 ? none("No shifts are rostered today.") : (
                <ul className="text-[14px]">{o.roster.map((r) => <li key={r.code} className="flex justify-between gap-2 py-[3px]"><span>{r.shift}</span><span className="font-mono">{r.count}</span></li>)}</ul>
              )}
              {o.unrosteredToday > 0 && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">{o.unrosteredToday} without a shift today.</p>}
            </Panel>
            {showPayroll && (
              <Panel title="Payroll" href="/hr/payroll" action="Open payroll">
                {o.payroll ? (
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-[14px] font-medium">{monthLabel(o.payroll.month)}</p><p className="font-mono text-[22px] font-bold">{rupees(o.payroll.totalNet)}</p><p className="text-[12px] text-[color:var(--ink-soft)]">net pay</p></div>
                    <Pill>{o.payroll.status ?? ""}</Pill>
                  </div>
                ) : none("Payroll hasn't been run yet.")}
              </Panel>
            )}
          </div>
        </>
      )}
    </MrdShell>
  );
}
