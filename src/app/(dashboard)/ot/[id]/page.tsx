"use client";

import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { OtRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[14px] font-normal text-[color:var(--ink)]">{value || "—"}</p>
    </div>
  );
}

export default function OtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canWrite = can("ot", "write");
  const { item: record, loading, reload } = useItem<OtRecordDTO>(`/ot/${id}`);
  useBreadcrumb("/ot", "OT", record?.procedure ?? "Procedure");
  const { run, loading: acting, error } = useMutation();

  const setStatus = (status: string) => run(() => api.patch(`/ot/${id}`, { status })).then(reload);

  if (loading) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[color:var(--ink-soft)]">Loading…</p></div>;
  }
  if (!record) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[color:var(--ink-soft)]">
          OT record not found. <Link href="/ot" className="text-[color:var(--brand)] underline">Back to OT</Link>
        </p>
      </div>
    );
  }

  const locked = record.status === "Completed" || record.status === "Cancelled";

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/ot" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Operation Theatre</div>
          <div className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{record.procedure}</div>
        </div>
        <StatusBadge status={record.status} />
      </div>

      <div className={`${tw.gutterX} py-6`} style={{ maxWidth: 900 }}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8 flex flex-col gap-7`}>
          <section>
            <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Patient & Procedure</h3>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Patient" value={record.patientName} />
              <Field label="Procedure / Surgery Name" value={record.procedure} />
            </div>
          </section>

          <div className="border-t border-[color:var(--subtle-2)]" />

          <section>
            <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">OT Scheduling</h3>
            <div className="grid grid-cols-3 gap-5">
              <Field label="OT Room" value={record.otRoom} />
              <Field label="Scheduled Date" value={formatDate(record.scheduledDate)} />
              <Field label="Start Time" value={record.scheduledTime} />
            </div>
          </section>

          <div className="border-t border-[color:var(--subtle-2)]" />

          <section>
            <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-4">Surgical Team</h3>
            <div className="grid grid-cols-3 gap-5">
              <Field label="Primary Surgeon" value={record.surgeon} />
              <Field label="Anaesthetist" value={record.anesthetist} />
            </div>
          </section>

          <div className="border-t border-[color:var(--subtle-2)]" />

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Status</h3>
              <StatusBadge status={record.status} />
            </div>
            {error && <div className="mb-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
            {canWrite && (
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setStatus("In Progress")} disabled={acting || record.status !== "Scheduled"}
                  className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Start procedure
                </button>
                <button onClick={() => setStatus("Completed")} disabled={acting || locked}
                  className="text-[13px] font-normal text-[color:var(--brand)] border border-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-soft)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Mark completed
                </button>
                <button onClick={() => setStatus("Cancelled")} disabled={acting || locked}
                  className="text-[13px] font-normal text-[#ff0004] border border-[#ff0004] px-4 py-[8px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Cancel
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
