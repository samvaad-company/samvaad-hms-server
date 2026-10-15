"use client";

/**
 * Shared letterhead for printable documents (invoices, prescriptions, lab
 * reports).
 *
 * Details come from Admin → Settings rather than being hardcoded per page.
 * Previously each document embedded its own address and GST number, so an
 * invoice, a prescription and the settings screen each claimed a different
 * hospital identity.
 */
import { Building2 } from "lucide-react";
import { useItem } from "@/lib/api/hooks";

export interface HospitalSettings {
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
  gstNumber: string;
  regNumber: string;
  logoUrl?: string | null;
}

/** Hospital details for use in document headers and footers. */
export function useHospital(): HospitalSettings {
  const { item } = useItem<HospitalSettings>("/admin/settings");
  return (
    item ?? {
      name: "", address: "", city: "", state: "", pincode: "",
      phone: "", email: "", website: "", gstNumber: "", regNumber: "",
    }
  );
}

/** One-line address, skipping any parts that aren't filled in. */
export function hospitalAddress(h: HospitalSettings): string {
  return [h.address, h.city, h.state, h.pincode].filter(Boolean).join(", ");
}

export function DocumentLetterhead({
  hospital,
  right,
  compact,
}: {
  hospital: HospitalSettings;
  /** Document-specific block on the right (number, date, status). */
  right?: React.ReactNode;
  compact?: boolean;
}) {
  const address = hospitalAddress(hospital);
  const meta = [
    hospital.phone && `Phone: ${hospital.phone}`,
    hospital.gstNumber && `GSTIN: ${hospital.gstNumber}`,
  ].filter(Boolean).join(" · ");

  return (
    <div
      className={`flex items-start justify-between gap-6 ${compact ? "px-8 py-5" : "px-8 py-6"}`}
      style={{ borderBottom: "1px solid var(--line)" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        {/* Logo mark — an uploaded logo replaces this when configured. */}
        {hospital.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hospital.logoUrl} alt="" className="w-12 h-12 rounded-[10px] object-contain shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-[10px] bg-[color:var(--brand)] flex items-center justify-center shrink-0">
            <Building2 size={22} strokeWidth={1.5} className="text-white" />
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[17px] font-medium text-[color:var(--ink)] truncate">
            {hospital.name || "Hospital"}
          </div>
          {address && (
            <div className="text-[12px] font-light text-[color:var(--ink-soft)]">{address}</div>
          )}
          {meta && (
            <div className="text-[12px] font-light text-[color:var(--ink-soft)]">{meta}</div>
          )}
        </div>
      </div>
      {right && <div className="text-right shrink-0">{right}</div>}
    </div>
  );
}

/** Matching footer line for printed documents. */
export function DocumentFooter({ hospital }: { hospital: HospitalSettings }) {
  return (
    <div className="px-8 pb-8 text-[11px] font-light text-[color:var(--ink-soft)] text-center">
      Thank you for choosing {hospital.name || "our hospital"}.
      {hospital.phone ? ` For queries call ${hospital.phone}.` : ""}
      {hospital.regNumber ? ` Reg. No. ${hospital.regNumber}.` : ""}
    </div>
  );
}
