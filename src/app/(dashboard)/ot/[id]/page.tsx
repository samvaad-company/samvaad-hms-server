"use client";

import { useParams, useRouter } from "next/navigation";
import { tw } from "@/lib/design-system";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { useRowActions } from "@/lib/api/useRowActions";
import type { OtRecordDTO } from "@/types/api";
import { BookingDetails } from "@/components/ot/BookingDetails";
import { surgeryOf } from "@/components/ot/shared";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function OtDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("ot", "write");
  const { item: record, loading, reload } = useItem<OtRecordDTO>(`/ot/${id}`);
  useBreadcrumb("/ot", "OT", record ? surgeryOf(record) : "Surgery");
  const { dialog, remove } = useRowActions("ot", () => router.push("/ot"));

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

  return (
    <>
      {dialog}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/ot" aria-label="Back to OT" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Operation Theatre · {record.bookingNo}</div>
          <div className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{surgeryOf(record)}</div>
        </div>
      </div>
      <div className={`${tw.gutterX} py-6`} style={{ maxWidth: 820 }}>
        <div className={`${tw.surface.card} ${tw.radius.card} p-8`}>
          <BookingDetails b={record} canWrite={canWrite} onChanged={reload} onEdit={() => router.push(`/ot?open=${record.id}`)} onDelete={() => remove(record.id, surgeryOf(record))} />
        </div>
      </div>
    </>
  );
}
