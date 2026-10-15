"use client";

/**
 * Tele-caller: make a booking link for one patient and send it. The patient
 * opens it, picks a doctor and time, pays and gets their video link — no login.
 */
import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { Modal } from "@/components/shared/Modal";
import { FormRow } from "@/components/shared/FormRow";
import { PatientPicker } from "@/components/shared/PatientPicker";
import type { PatientDTO, TeleconsultBookingLinkDTO, TeleconsultConfigDTO } from "@/types/api";

export function BookingLinkModal({
  open, onClose, config,
}: {
  open: boolean;
  onClose: () => void;
  config: TeleconsultConfigDTO | null;
}) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading } = useMutation();
  const [patientId, setPatientId] = useState("");
  const [link, setLink] = useState<TeleconsultBookingLinkDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url = link ? `${window.location.origin}${link.path}` : "";
  const fee = config?.price != null ? `₹${config.price.toLocaleString("en-IN")}` : "";
  const message = link
    ? `Hello ${link.patientName.split(" ")[0]}, you can book a video consultation${fee ? ` (fee ${fee})` : ""} here: ${url}\nThe link is valid for 7 days.`
    : "";
  // wa.me wants digits only, with the country code; assume India for a bare 10-digit number.
  const digits = link?.patientPhone.replace(/\D/g, "") ?? "";
  const waNumber = digits.length === 10 ? `91${digits}` : digits.replace(/^0+/, "");

  function reset() {
    setPatientId("");
    setLink(null);
    setError(null);
    setCopied(false);
  }

  async function generate() {
    setError(null);
    try {
      setLink(await run(() => api.post<TeleconsultBookingLinkDTO>("/teleconsult/links", { patientId: Number(patientId) })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the link.");
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* the link is selectable in the box */ }
  }

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="Send booking link" width={540}
      footer={
        <div className="flex justify-end gap-3">
          <button onClick={() => { onClose(); reset(); }} className="text-[13px] text-[color:var(--ink-soft)] px-4 py-[8px] rounded-full border border-[color:var(--line)] cursor-pointer">
            {link ? "Done" : "Cancel"}
          </button>
          {!link && (
            <button onClick={generate} disabled={!patientId || loading}
              className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
              {loading ? "Creating…" : "Create link"}
            </button>
          )}
        </div>
      }>
      {!link ? (
        // Room under the picker so its suggestion list isn't clipped by the modal body.
        <div className="flex flex-col gap-4 min-h-[320px]">
          <p className="text-[13px] font-light text-[color:var(--ink-soft)]">
            The patient opens the link, chooses a doctor and time, pays {fee ? <b className="font-medium text-[color:var(--ink)]">{fee}</b> : "the fee"} online
            and receives their video link. No login needed.
          </p>
          <FormRow label="Patient" required>
            <PatientPicker patients={patients} value={patientId} onChange={(id) => setPatientId(id)} />
          </FormRow>
          {error && <p className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-[color:var(--ink-soft)]">Link for <b className="text-[color:var(--ink)]">{link.patientName}</b> — valid for 7 days.</p>
          <textarea readOnly rows={5} value={message} onFocus={(e) => e.currentTarget.select()}
            className="w-full bg-[color:var(--subtle)] border border-[color:var(--line)] rounded-[8px] px-3 py-2 text-[13px] text-[color:var(--ink)] resize-none" />
          <div className="flex gap-3 flex-wrap">
            <button onClick={copy}
              className="inline-flex items-center gap-2 text-[13px] text-[color:var(--brand)] border border-[color:var(--brand)] px-4 py-[8px] rounded-full hover:bg-[color:var(--brand-soft)] cursor-pointer">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy message"}
            </button>
            {waNumber && (
              <a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] text-white bg-[#25a244] px-4 py-[9px] rounded-full hover:bg-[#1e8a39]">
                <MessageCircle size={14} /> Send on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
