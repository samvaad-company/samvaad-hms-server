"use client";

import { useRef } from "react";
import { Printer, Download } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { PatientBarcode } from "@/components/shared/PatientBarcode";
import { useHospital } from "@/components/shared/DocumentLetterhead";
import { printElement, downloadElement } from "@/lib/print";
import type { PatientDTO } from "@/types/api";

/**
 * Printable patient ID card — the barcode itself encodes name, patient ID,
 * age, and hospital name (pipe-delimited), so scanning it recovers all four
 * fields without a lookup; the same fields are also shown as readable text.
 */
export function PatientIdCardModal({
  patient,
  onClose,
}: {
  patient: PatientDTO;
  onClose: () => void;
}) {
  const hospital = useHospital();
  const cardRef = useRef<HTMLDivElement>(null);
  const patientCode = patient.patientId ?? String(patient.id);
  const barcodeValue = [patientCode, patient.name, String(patient.age), hospital.name || "Hospital"].join("|");

  return (
    <Modal
      open
      onClose={onClose}
      title="Patient ID Card"
      width={420}
      footer={
        <>
          <button
            onClick={() => downloadElement(cardRef.current, `ID Card - ${patient.name}`)}
            className="flex items-center gap-2 text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors"
          >
            <Download size={14} /> Download
          </button>
          <button
            onClick={() => printElement(cardRef.current, `ID Card - ${patient.name}`)}
            className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors"
          >
            <Printer size={14} /> Print
          </button>
        </>
      }
    >
      <div ref={cardRef} className="border border-[color:var(--line)] rounded-[14px] overflow-hidden bg-[color:var(--surface)] mx-auto" style={{ width: 340 }}>
        <div className="bg-[color:var(--brand)] px-5 py-3">
          <p className="text-[13px] font-medium text-white truncate">{hospital.name || "Hospital"}</p>
          <p className="text-[10px] font-light text-white/80 uppercase tracking-wider">Patient Identification Card</p>
        </div>
        <div className="p-5 flex flex-col gap-3">
          <div>
            <p className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{patient.name}</p>
            <p className="text-[12px] font-light text-[color:var(--ink-soft)]">{patientCode}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Age</p>
              <p className="text-[13px] font-normal text-[color:var(--ink)]">{patient.age} yrs</p>
            </div>
            <div>
              <p className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Gender</p>
              <p className="text-[13px] font-normal text-[color:var(--ink)]">{patient.gender}</p>
            </div>
          </div>
          <div className="border-t border-dashed border-[color:var(--line)] pt-3 flex flex-col items-center gap-1">
            <PatientBarcode value={barcodeValue} className="w-full" />
            <p className="text-[11px] font-normal text-[color:var(--ink)] tracking-wider">{patientCode}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
