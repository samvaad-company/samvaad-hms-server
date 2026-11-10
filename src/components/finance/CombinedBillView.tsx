"use client";

/**
 * Finance → Combined bill: pick a patient (and, if wanted, a date range) and get every charge on one statement: IPD, consultation,
 * pharmacy, lab, radiology and the rest, grouped with subtotals, the prescriptions beneath, and the totals. Print it or save as PDF.
 */
import { useMemo, useRef, useState } from "react";
import { Download, FileText, Printer } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useList } from "@/lib/api/hooks";
import { printElement, downloadElement } from "@/lib/print";
import { DocumentLetterhead, useHospital } from "@/components/shared/DocumentLetterhead";
import { FormRow, FormInput } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import type { CombinedBillDTO, PatientDTO } from "@/types/api";

const money = (n: number) => n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CombinedBillView() {
  const hospital = useHospital();
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const [patientId, setPatientId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [path, setPath] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => patients.map((p) => ({ value: String(p.id), patientId: p.id, label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` })), [patients]);
  const { item: bill, loading, error } = useItem<CombinedBillDTO>(path);

  const generate = () => {
    const q = new URLSearchParams({ patientId });
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    setPath(`/finance/combined-bill?${q.toString()}`);
  };
  const title = bill ? `Combined bill — ${bill.patient.name}` : "Combined bill";
  const empty = bill && bill.sections.length === 0;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(180px,1fr))] items-end">
        <FormRow label="Patient *"><SearchSelect placeholder="Search a patient…" value={patientId} onChange={(v) => { setPatientId(v); setPath(null); }} options={options} /></FormRow>
        <FormRow label="From (optional)"><FormInput type="date" value={from} onChange={(v) => { setFrom(v); setPath(null); }} /></FormRow>
        <FormRow label="To (optional)"><FormInput type="date" value={to} onChange={(v) => { setTo(v); setPath(null); }} /></FormRow>
        <button onClick={generate} disabled={!patientId || loading} className="inline-flex h-[40px] items-center justify-center gap-2 rounded-full bg-[color:var(--brand)] px-5 text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
          <FileText size={14} /> {loading ? "Preparing…" : "Create combined bill"}
        </button>
      </div>
      <p className="text-[12px] text-[color:var(--ink-soft)]">Leave the dates empty to include everything this patient has been billed. For one admission, set From to the admission date and To to the discharge date.</p>

      {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}

      {bill && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => printElement(docRef.current, title)} className="inline-flex h-[34px] items-center gap-2 rounded-full bg-[color:var(--brand)] px-4 text-[13px] text-white hover:bg-[color:var(--brand-hover)] cursor-pointer"><Printer size={14} /> Print</button>
            <button onClick={() => downloadElement(docRef.current, title)} className="inline-flex h-[34px] items-center gap-2 rounded-full border border-[color:var(--line)] px-4 text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><Download size={14} /> Download</button>
            <span className="text-[12px] text-[color:var(--ink-soft)]">{bill.billCount} {bill.billCount === 1 ? "bill" : "bills"} combined{bill.refundedCount ? ` · ${bill.refundedCount} refunded left out` : ""}</span>
          </div>

          <div ref={docRef} className={`${tw.surface.card} ${tw.radius.card} mx-auto w-full max-w-[900px] overflow-hidden`}>
            <DocumentLetterhead hospital={hospital} compact right={<><div className="text-[16px] font-medium text-[color:var(--ink)]">Combined Bill</div><div className="mt-1 text-[12px] text-[color:var(--ink-soft)]">{bill.period.from || bill.period.to ? `${bill.period.from ? formatDate(bill.period.from) : "Start"} to ${bill.period.to ? formatDate(bill.period.to) : "today"}` : "All charges"}</div></>} />

            <div className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-[color:var(--subtle-2)] px-6 py-4 text-[13px] sm:grid-cols-2">
              <Info label="Patient" value={bill.patient.name} />
              <Info label="Patient ID" value={bill.patient.code} />
              <Info label="Age / Sex" value={`${bill.patient.age} / ${bill.patient.gender}`} />
              <Info label="Phone" value={bill.patient.phone} />
              {bill.patient.address && <div className="sm:col-span-2"><Info label="Address" value={bill.patient.address} /></div>}
              {bill.admission && <>
                <Info label="Admission no." value={bill.admission.admissionNo || "—"} />
                <Info label="Admitted on" value={formatDate(bill.admission.admittedOn)} />
                <Info label="Ward / Bed" value={[bill.admission.ward, bill.admission.bed].filter(Boolean).join(" · ") || "—"} />
                <Info label="Consultant" value={bill.admission.doctor || "—"} />
                {bill.admission.diagnosis && <div className="sm:col-span-2"><Info label="Diagnosis" value={bill.admission.diagnosis} /></div>}
              </>}
            </div>

            {empty ? (
              <p className="px-6 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">This patient has no bills in that period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-[color:var(--subtle)] text-left text-[11px] uppercase tracking-wider text-[color:var(--ink-soft)]">
                      <th className="px-6 py-2 font-medium">Service</th><th className="px-2 py-2 font-medium">Date</th><th className="px-2 py-2 text-right font-medium">Qty</th><th className="px-2 py-2 text-right font-medium">Rate (₹)</th><th className="px-6 py-2 text-right font-medium">Net (₹)</th>
                    </tr>
                  </thead>
                  {bill.sections.map((s) => (
                    <tbody key={s.type}>
                      <tr className="bg-[color:var(--subtle)]/60"><td colSpan={4} className="px-6 py-[7px] text-[12px] font-semibold uppercase tracking-wider text-[color:var(--ink)]">{s.title}</td><td className="px-6 py-[7px] text-right text-[12px] font-semibold">{money(s.subtotal)}</td></tr>
                      {s.lines.map((l, i) => (
                        <tr key={i} className="border-b border-[color:var(--subtle-2)]">
                          <td className="px-6 py-[6px] text-[color:var(--ink)]">{l.name}</td>
                          <td className="whitespace-nowrap px-2 py-[6px] text-[color:var(--ink-soft)]">{formatDate(l.date)}</td>
                          <td className="px-2 py-[6px] text-right">{l.quantity}</td>
                          <td className="px-2 py-[6px] text-right">{money(l.rate)}</td>
                          <td className="px-6 py-[6px] text-right">{money(l.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  ))}
                </table>
              </div>
            )}

            {bill.prescriptions.length > 0 && (
              <div className="border-t border-[color:var(--subtle-2)] px-6 py-4">
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[color:var(--ink)]">Prescriptions <span className="font-normal normal-case text-[color:var(--ink-soft)]">· no charge</span></p>
                <ul className="flex flex-col gap-2 text-[13px]">
                  {bill.prescriptions.map((r) => (
                    <li key={r.rxNumber}>
                      <span className="font-medium">{r.rxNumber}</span> <span className="text-[color:var(--ink-soft)]">· {formatDate(r.date)} · {r.doctor}{r.diagnosis ? ` · ${r.diagnosis}` : ""}</span>
                      {r.medicines.length > 0 && <div className="text-[12px] text-[color:var(--ink-soft)]">{r.medicines.join("; ")}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="ml-auto flex w-full max-w-[340px] flex-col gap-[6px] border-t border-[color:var(--subtle-2)] px-6 py-4 text-[13px] sm:mr-0">
              <Total label="Total charges" value={bill.totals.gross} />
              {bill.totals.discount > 0 && <Total label="Discount" value={-bill.totals.discount} />}
              {bill.totals.gst > 0 && <Total label="GST" value={bill.totals.gst} />}
              <Total label="Net payable" value={bill.totals.total} strong />
              <Total label="Paid" value={bill.totals.paid} />
              <Total label="Balance due" value={bill.totals.due} strong />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><span className="w-[110px] shrink-0 text-[color:var(--ink-soft)]">{label}</span><span className="min-w-0 break-words font-medium text-[color:var(--ink)]">{value}</span></div>;
}

function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return <div className={`flex justify-between gap-4 ${strong ? "border-t border-[color:var(--line)] pt-[6px] text-[14px] font-semibold" : ""}`}><span>{label}</span><span>₹{value < 0 ? "-" : ""}{money(Math.abs(value))}</span></div>;
}
