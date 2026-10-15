"use client";

/**
 * Printable insurance claim form for a TPA claim.
 *
 * Produces the pre-authorisation / reimbursement sheet a hospital sends to the
 * insurer: hospital letterhead, insurer and policy details, patient details,
 * the claimed amount, and declaration signatures. Printing and downloading
 * reuse the shared document helpers, so only this form is output — not the
 * surrounding app.
 */
import { useRef } from "react";
import { Printer, Download, X } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import {
  DocumentLetterhead,
  useHospital,
} from "@/components/shared/DocumentLetterhead";
import { printElement, downloadElement } from "@/lib/print";
import { formatDate } from "@/lib/dates";
import { useList } from "@/lib/api/hooks";
import type { TpaClaimDTO, TpaDTO, PatientDTO } from "@/types/api";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">{label}</p>
      <p className="text-[13px] font-normal text-[color:var(--ink)] mt-[2px]">{value || "—"}</p>
    </div>
  );
}

export function ClaimForm({
  claim,
  onClose,
}: {
  claim: TpaClaimDTO;
  onClose: () => void;
}) {
  const hospital = useHospital();
  const docRef = useRef<HTMLDivElement>(null);
  const { items: tpas } = useList<TpaDTO>("/tpa", { all: true });
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });

  const tpa = tpas.find((t) => t.id === claim.tpaId);
  const patient = patients.find(
    (p) => p.id === claim.patientId || p.name === claim.patientName,
  );
  const title = `Claim Form — ${claim.patientName}`;

  return (
    <Modal
      open
      onClose={onClose}
      title="Insurance Claim Form"
      width={860}
      footer={
        <>
          <button
            onClick={onClose}
            className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors"
          >
            <X size={13} className="inline mr-1" /> Close
          </button>
          <button
            onClick={() => downloadElement(docRef.current, title)}
            className="text-[13px] font-normal text-[color:var(--ink-soft)] border border-[color:var(--line)] px-5 py-[8px] rounded-full hover:bg-[color:var(--subtle)] transition-colors"
          >
            <Download size={13} className="inline mr-1" /> Download
          </button>
          <button
            onClick={() => printElement(docRef.current, title)}
            className="text-[13px] font-normal text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] transition-colors"
          >
            <Printer size={13} className="inline mr-1" /> Print
          </button>
        </>
      }
    >
      <div ref={docRef} className="bg-[color:var(--surface)] border border-[color:var(--line)] rounded-[10px] overflow-hidden">
        <DocumentLetterhead
          hospital={hospital}
          compact
          right={
            <>
              <div className="text-[15px] font-medium text-[color:var(--ink)]">CLAIM FORM</div>
              <div className="text-[12px] font-light text-[color:var(--ink-soft)] mt-1">
                Claim #{String(claim.id).padStart(5, "0")}
              </div>
              <div className="text-[12px] font-light text-[color:var(--ink-soft)]">
                {formatDate(claim.date)}
              </div>
            </>
          }
        />

        {/* Insurer */}
        <div className="px-8 py-4 border-b border-[color:var(--subtle-2)]">
          <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">
            Insurer / TPA
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="TPA Name" value={claim.tpaName} />
            <Field label="TPA Code" value={tpa?.code ?? ""} />
            <Field label="Contact" value={tpa?.phone ?? ""} />
          </div>
        </div>

        {/* Patient */}
        <div className="px-8 py-4 border-b border-[color:var(--subtle-2)]">
          <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">
            Patient / Insured
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Name" value={claim.patientName} />
            <Field label="Hospital ID" value={patient?.patientId ?? ""} />
            <Field label="Age / Gender" value={patient ? `${patient.age} yrs · ${patient.gender}` : ""} />
            <Field label="Phone" value={patient?.phone ?? ""} />
            <Field label="Policy Number" value={patient?.policyNumber ?? ""} />
            <Field label="Insurer on File" value={patient?.insurer ?? ""} />
          </div>
        </div>

        {/* Claim */}
        <div className="px-8 py-4 border-b border-[color:var(--subtle-2)]">
          <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-3">
            Claim Details
          </p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Bill Number" value={claim.billNumber} />
            <Field label="Claim Date" value={formatDate(claim.date)} />
            <Field label="Status" value={claim.status} />
          </div>
          <div className="mt-4 flex items-center justify-end gap-8 border-t border-[color:var(--subtle-2)] pt-4">
            <div className="text-right">
              <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Amount Claimed</p>
              <p className="text-[18px] font-medium text-[color:var(--ink)]">
                ₹{claim.claimAmount.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Amount Approved</p>
              <p className="text-[18px] font-medium text-[color:var(--brand)]">
                {claim.approvedAmount > 0 ? `₹${claim.approvedAmount.toLocaleString("en-IN")}` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Declaration + signatures */}
        <div className="px-8 py-5">
          <p className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Declaration</p>
          <p className="text-[12px] font-light text-[color:var(--ink-soft)] leading-relaxed">
            I certify that the information given above is true to the best of my knowledge and that
            the treatment described was provided at {hospital.name || "this hospital"}. I authorise
            the release of medical information necessary to process this claim.
          </p>
          <div className="flex items-end justify-between mt-10">
            {["Patient / Insured", "Treating Doctor", "Authorised Signatory"].map((role) => (
              <div key={role} className="flex flex-col items-center gap-1">
                <div className="w-[150px] border-b border-[color:var(--ink-soft)]" />
                <p className="text-[11px] font-light text-[color:var(--ink-soft)]">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
