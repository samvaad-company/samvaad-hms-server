"use client";

/** Setup → Plan & licence: the hospital's plan, seats and licence details, with how many are in use. */
import { BadgeCheck } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { useList } from "@/lib/api/hooks";
import type { AdminUserDTO } from "@/types/api";
import { dmy, todayLocal } from "@/components/mrd/shared";
import { ConfigCard } from "@/components/setup/ConfigCard";
import { useConfig } from "@/components/setup/ui";

export default function PlanPage() {
  const { can, loading: authLoading } = useAuth();
  const { item, reload } = useConfig("plan");
  const users = useList<AdminUserDTO>("/admin/users", { all: true });
  if (authLoading) return null;
  if (!can("admin", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The plan is managed by hospital administrators.</p></div>;
  const seats = Number(item?.seats ?? 0);
  const inUse = users.items.filter((u) => u.status !== "Inactive").length;
  const until = String(item?.validUntil ?? "");
  const daysLeft = until ? Math.round((new Date(`${until}T00:00:00Z`).getTime() - new Date(`${todayLocal()}T00:00:00Z`).getTime()) / 86_400_000) : null;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
        <div className="flex items-center gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <BadgeCheck size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Plan &amp; licence</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">What the hospital is licensed for</span>
        </div>
        {!item ? <p className="px-5 py-10 text-[14px] text-[color:var(--ink-soft)]">Loading…</p> : (
          <div className="grid items-start gap-4 p-5" style={{ gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)" }}>
            <ConfigCard title="Plan" configKey="plan" values={item} canEdit={can("admin", "write")} onSaved={reload}
              rows={[[{ key: "planName", label: "Plan" }, { key: "billingCycle", label: "Billing cycle", type: "select", options: ["Monthly", "Quarterly", "Annual"].map((v) => ({ value: v, label: v })) }], [{ key: "seats", label: "User seats (0 = unlimited)", type: "number" }, { key: "validUntil", label: "Licence valid until", type: "date" }], [{ key: "licenceKey", label: "Licence key", mono: true }], [{ key: "supportContact", label: "Support contact" }]]} />
            <section className="rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] p-5">
              <h2 className="mb-3 text-[14px] font-semibold">In use</h2>
              <p className="font-mono text-[28px] font-bold">{inUse}<span className="text-[15px] font-normal text-[color:var(--ink-soft)]"> / {seats > 0 ? seats : "∞"}</span></p>
              <p className="text-[13px] text-[color:var(--ink-soft)]">active user logins</p>
              {seats > 0 && inUse > seats && <p role="alert" className="mt-3 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{inUse - seats} more logins than the plan has seats for.</p>}
              {daysLeft !== null && (
                <p className={`mt-4 text-[13px] ${daysLeft < 0 ? "text-[#c8001a]" : daysLeft <= 30 ? "text-[#8a5300]" : "text-[color:var(--ink-soft)]"}`}>
                  {daysLeft < 0 ? `The licence lapsed ${-daysLeft} ${-daysLeft === 1 ? "day" : "days"} ago (${dmy(until)}).` : `Valid until ${dmy(until)} — ${daysLeft} ${daysLeft === 1 ? "day" : "days"} left.`}
                </p>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
