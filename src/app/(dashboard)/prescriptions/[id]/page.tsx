"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem } from "@/lib/api/hooks";
import { printElement, downloadElement, shareDocument } from "@/lib/print";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { PrescriptionDTO } from "@/types/api";
import { Printer, Share2, Download, QrCode } from "lucide-react";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { item: rx, loading } = useItem<PrescriptionDTO>(`/prescriptions/${id}`);
  useBreadcrumb("/prescriptions", "Prescriptions", rx?.rxNumber ?? "Prescription");
  const docRef = useRef<HTMLDivElement>(null);
  const hospital = useHospital();
  const printRx = () => printElement(docRef.current, rx ? `Prescription ${rx.rxNumber}` : "Prescription");

  if (loading) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">Loading…</p>
      </div>
    );
  }
  if (!rx) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">Prescription not found.</p>
      </div>
    );
  }

  const meds = rx.items.map(it => ({
    name: it.medicineName,
    dosage: it.dosage,
    frequency: it.frequency,
    duration: it.duration,
    instructions: it.instructions ?? "—",
  }));

  return (
    <>
      {/* Actions */}
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-end`}>
        <div className="flex items-center gap-2">
          <button onClick={() => shareDocument(`Prescription ${rx.rxNumber}`, window.location.href)} className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
            <Share2 size={14} /> Share
          </button>
          <button onClick={() => downloadElement(docRef.current, `Prescription ${rx.rxNumber}`)} className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
            <Download size={14} /> Download
          </button>
          <button onClick={printRx} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div ref={docRef} className={`${tw.surface.card} ${tw.radius.card} overflow-hidden max-w-[860px] mx-auto`}>
          {/* Hospital header */}
          <DocumentLetterhead
            hospital={hospital}
            right={
              <>
                <div className="text-[13px] font-medium text-[#009598]">{rx.rxNumber}</div>
                <div className="text-[12px] font-light text-[#57575f]">Date: {formatDate(rx.date)}</div>
                <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal mt-1 ${rx.status === "Dispensed" ? "bg-[#dffff3] text-[#00955c]" : rx.status === "Pending" ? "bg-[#fff2e0] text-[#ff9000]" : "bg-[#f0f0f0] text-[#57575f]"}`}>{rx.status}</span>
              </>
            }
          />

          {/* Patient + Doctor info */}
          <div className="px-8 py-4 grid grid-cols-2 gap-4 border-b border-[#f0f0f0]">
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Patient</p>
              <p className="text-[15px] font-medium text-[#11111c]">{rx.patientName}</p>
              <p className="text-[12px] font-light text-[#57575f]">{rx.patientAge} years</p>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Physician</p>
              <p className="text-[15px] font-medium text-[#11111c]">{rx.doctor}</p>
              <p className="text-[12px] font-light text-[#57575f]">General Medicine</p>
            </div>
          </div>

          {/* Diagnosis */}
          <div className="px-8 py-4 border-b border-[#f0f0f0]">
            <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-1">Diagnosis</p>
            <p className="text-[14px] font-normal text-[#11111c]">{rx.diagnosis}</p>
          </div>

          {/* Medicines table */}
          <div className="px-8 py-5 border-b border-[#f0f0f0]">
            <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-3">Medicines</p>
            <div className="border border-[#dedee1] rounded-[10px] overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1.5fr_1fr_2fr] bg-[#f2f3f3] px-4 py-2">
                {["Medicine", "Dosage", "Frequency", "Duration", "Instructions"].map(h => (
                  <span key={h} className="text-[12px] font-medium text-[#11111c]">{h}</span>
                ))}
              </div>
              {meds.map((m, i) => (
                <div key={i} className={`grid grid-cols-[2fr_1fr_1.5fr_1fr_2fr] px-4 py-3 ${i < meds.length - 1 ? "border-b border-[#f0f0f0]" : ""}`}>
                  <span className="text-[13px] font-medium text-[#11111c]">{m.name}</span>
                  <span className="text-[13px] font-normal text-[#57575f]">{m.dosage}</span>
                  <span className="text-[13px] font-normal text-[#11111c]">{m.frequency}</span>
                  <span className="text-[13px] font-normal text-[#57575f]">{m.duration}</span>
                  <span className="text-[12px] font-light text-[#57575f]">{m.instructions}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes + signature + QR */}
          <div className="px-8 py-5 flex items-end justify-between">
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Clinical Notes</p>
              <p className="text-[13px] font-light text-[#57575f] max-w-[400px]">
                Review HbA1c in 3 months. Avoid high-sodium diet. Physical activity 30 min daily.
              </p>
              <p className="text-[12px] font-light text-[#57575f] mt-2">Follow-up: 4 weeks</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-[72px] h-[72px] bg-[#f0f0f0] rounded-[8px] flex items-center justify-center">
                <QrCode size={36} className="text-[#57575f]" />
              </div>
              <p className="text-[10px] font-light text-[#57575f]">Scan to verify</p>
            </div>
          </div>
          {/* Doctor signature */}
          <div className="px-8 pb-6 flex justify-end">
            <div className="flex flex-col items-center gap-1">
              <div className="w-[120px] border-b border-[#57575f]" />
              <p className="text-[12px] font-normal text-[#11111c]">{rx.doctor}</p>
              <p className="text-[11px] font-light text-[#57575f]">Signature & Seal</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
