"use client";

import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { OtRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">{label}</p>
      <p className="text-[14px] font-normal text-[#11111c]">{value || "—"}</p>
    </div>
  );
}

export default function OtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item: record, loading, reload } = useItem<OtRecordDTO>(`/ot/${id}`);
  useBreadcrumb("/ot", "OT", record?.procedure ?? "Procedure");
  const { run, loading: acting, error } = useMutation();

  const setStatus = (status: string) => run(() => api.patch(`/ot/${id}`, { status })).then(reload);

  if (loading) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] font-normal text-[#57575f]">Loading…</p></div>;
  }
  if (!record) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">
          OT record not found. <Link href="/ot" className="text-[#009598] underline">Back to OT</Link>
        </p>
      </div>
    );
  }

  const locked = record.status === "Completed" || record.status === "Cancelled";

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid #dedee1" }}>
        <Link href="/ot" className="p-2 rounded-[8px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Operation Theatre</div>
          <div className="text-[17px] font-medium text-[#11111c] leading-tight">{record.procedure}</div>
        </div>
        <StatusBadge status={record.status} />
      </div>

      <div className={`${tw.gutterX} py-6`} style={{ maxWidth: 900 }}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8 flex flex-col gap-7`}>
          <section>
            <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Patient & Procedure</h3>
            <div className="grid grid-cols-2 gap-5">
              <Field label="Patient" value={record.patientName} />
              <Field label="Procedure / Surgery Name" value={record.procedure} />
            </div>
          </section>

          <div className="border-t border-[#f0f0f0]" />

          <section>
            <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">OT Scheduling</h3>
            <div className="grid grid-cols-3 gap-5">
              <Field label="OT Room" value={record.otRoom} />
              <Field label="Scheduled Date" value={formatDate(record.scheduledDate)} />
              <Field label="Start Time" value={record.scheduledTime} />
            </div>
          </section>

          <div className="border-t border-[#f0f0f0]" />

          <section>
            <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider mb-4">Surgical Team</h3>
            <div className="grid grid-cols-3 gap-5">
              <Field label="Primary Surgeon" value={record.surgeon} />
              <Field label="Anaesthetist" value={record.anesthetist} />
            </div>
          </section>

          <div className="border-t border-[#f0f0f0]" />

          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[13px] font-medium text-[#57575f] uppercase tracking-wider">Status</h3>
              <StatusBadge status={record.status} />
            </div>
            {error && <div className="mb-3 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setStatus("In Progress")} disabled={acting || record.status !== "Scheduled"}
                className="text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Start procedure
              </button>
              <button onClick={() => setStatus("Completed")} disabled={acting || locked}
                className="text-[13px] font-normal text-[#009598] border border-[#009598] px-4 py-[8px] rounded-full hover:bg-[#e8f7f7] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Mark completed
              </button>
              <button onClick={() => setStatus("Cancelled")} disabled={acting || locked}
                className="text-[13px] font-normal text-[#ff0004] border border-[#ff0004] px-4 py-[8px] rounded-full hover:bg-[#ffe9e9] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Cancel
              </button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
