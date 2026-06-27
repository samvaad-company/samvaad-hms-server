"use client";

import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { prescriptions } from "@/data/prescriptions";
import { ChevronLeft, Printer, Share2, Download, QrCode } from "lucide-react";
import Link from "next/link";

// ─── Mock medicine data per prescription ─────────────────────────────────────

const RX_MEDICINES: Record<number, Array<{ name: string; dosage: string; frequency: string; duration: string; instructions: string }>> = {
  1: [
    { name: "Metformin 500mg",     dosage: "500mg",  frequency: "Twice daily (BD)",    duration: "30 days",  instructions: "Take with meals" },
    { name: "Losartan 50mg",       dosage: "50mg",   frequency: "Once daily (OD)",     duration: "30 days",  instructions: "Take in the morning" },
    { name: "Aspirin 75mg",        dosage: "75mg",   frequency: "Once daily (OD)",     duration: "30 days",  instructions: "Take after breakfast" },
  ],
  2: [
    { name: "Amoxicillin 500mg",   dosage: "500mg",  frequency: "Three times (TDS)",   duration: "7 days",   instructions: "Complete full course" },
    { name: "Paracetamol 500mg",   dosage: "500mg",  frequency: "As needed (PRN)",     duration: "3 days",   instructions: "Take for fever > 38°C" },
    { name: "Cetirizine 10mg",     dosage: "10mg",   frequency: "Once at night (OD)",  duration: "5 days",   instructions: "May cause drowsiness" },
    { name: "Vitamin C 500mg",     dosage: "500mg",  frequency: "Once daily (OD)",     duration: "14 days",  instructions: "—" },
  ],
  3: [
    { name: "Amlodipine 5mg",      dosage: "5mg",    frequency: "Once daily (OD)",     duration: "30 days",  instructions: "Take in the morning" },
    { name: "Metoprolol 25mg",     dosage: "25mg",   frequency: "Twice daily (BD)",    duration: "30 days",  instructions: "Do not skip doses" },
  ],
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrescriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rx = prescriptions.find(p => p.id === Number(id));

  if (!rx) {
    return (
      <div className={`${tw.gutterX} pt-10`}>
        <p className="text-[14px] font-normal text-[#57575f]">Prescription not found.</p>
      </div>
    );
  }

  const meds = RX_MEDICINES[rx.id] ?? RX_MEDICINES[1];

  return (
    <>
      {/* Back + actions */}
      <div className={`${tw.gutterX} mb-4 pt-2 flex items-center justify-between`}>
        <Link href="/prescriptions" className="inline-flex items-center gap-1 text-[13px] font-normal text-[#57575f] hover:text-[#11111c] transition-colors">
          <ChevronLeft size={15} /> Back to Prescriptions
        </Link>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
            <Share2 size={14} /> Share
          </button>
          <button className="flex items-center gap-2 text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-4 py-[7px] rounded-full hover:bg-[#f6f6f6] transition-colors">
            <Download size={14} /> PDF
          </button>
          <button className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-[7px] rounded-full hover:bg-[#007f82] transition-colors">
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden max-w-[860px] mx-auto`}>
          {/* Hospital header */}
          <div className="px-8 py-6 border-b border-[#dedee1] flex items-start justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-[20px] font-medium text-[#11111c]">Samvaad Hospital</span>
              <span className="text-[12px] font-light text-[#57575f]">12 MG Road, Koramangala, Bengaluru — 560095</span>
              <span className="text-[12px] font-light text-[#57575f]">Phone: +91 80-4000-0000 · GSTIN: 29AABCA1234C1Z5</span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[13px] font-medium text-[#009598]">{rx.rxNumber}</span>
              <span className="text-[12px] font-light text-[#57575f]">Date: {rx.date}</span>
              <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-normal mt-1 ${rx.status === "Dispensed" ? "bg-[#dffff3] text-[#00955c]" : rx.status === "Pending" ? "bg-[#fff2e0] text-[#ff9000]" : "bg-[#f0f0f0] text-[#57575f]"}`}>{rx.status}</span>
            </div>
          </div>

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
