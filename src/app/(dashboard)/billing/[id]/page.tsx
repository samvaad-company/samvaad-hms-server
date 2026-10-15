"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { ArrowLeft, Printer, Download, Share2, Building2 } from "lucide-react";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { printElement, downloadElement, shareDocument } from "@/lib/print";
import type { BillDTO, PatientDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { AbhaBadge } from "@/components/shared/AbhaBadge";
import { DocumentLetterhead, DocumentFooter, useHospital } from "@/components/shared/DocumentLetterhead";
import Link from "next/link";

const LINE_ITEMS: Record<string, { description: string; qty: number; rate: number }[]> = {
  "OPD":      [{ description: "OPD Consultation", qty: 1, rate: 500 }],
  "Lab":      [{ description: "Lab Test — Blood Panel", qty: 1, rate: 800 }, { description: "Sample Collection", qty: 1, rate: 100 }],
  "Pharmacy": [{ description: "Medicines (Rx)", qty: 1, rate: 1000 }, { description: "Injection / IV", qty: 1, rate: 240 }],
  "IPD":      [
    { description: "Room Charges (5 nights)", qty: 5, rate: 2000 },
    { description: "Doctor Visits", qty: 5, rate: 500 },
    { description: "Nursing Care", qty: 1, rate: 3000 },
    { description: "Medicines", qty: 1, rate: 5000 },
    { description: "Investigations", qty: 1, rate: 3000 },
    { description: "Procedure Charges", qty: 1, rate: 5000 },
  ],
};

const PAYMENT_MODE: Record<number, string> = {
  1: "Cash", 2: "UPI", 3: "Card", 4: "Cash + Card (Split)",
  5: "UPI", 6: "Insurance + Card (Split)", 7: "Pending", 8: "Cash", 9: "Refunded", 10: "UPI",
};

export default function BillingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const canWrite = can("billing", "write");
  const { item: bill, loading, reload } = useItem<BillDTO>(`/billing/${id}`);
  useBreadcrumb("/billing", "Billing", bill?.billNumber ?? "Invoice");
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading: acting } = useMutation();
  const docRef = useRef<HTMLDivElement>(null);
  const hospital = useHospital();
  const recordPayment = () => run(() => api.patch(`/billing/${id}`, { status: "Paid" })).then(reload);
  const docTitle = bill ? `Invoice ${bill.billNumber}` : "Invoice";
  const printInvoice = () => printElement(docRef.current, docTitle);
  /** Save the invoice as a self-contained file, without the print dialog. */
  const downloadInvoice = () => downloadElement(docRef.current, docTitle);
  /** Native share sheet where available, otherwise copy the link. */
  const shareInvoice = () => shareDocument(docTitle, window.location.href);

  if (loading) {
    return <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>Loading…</div>;
  }
  if (!bill) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[color:var(--ink-soft)]`}>
        Invoice not found.{" "}
        <Link href="/billing" className="text-[color:var(--brand)] underline">Back to Billing</Link>
      </div>
    );
  }

  const patient = patients.find(p => p.name === bill.patientName);
  const items = LINE_ITEMS[bill.type] ?? [{ description: `${bill.type} Charges`, qty: 1, rate: bill.amount }];
  const subtotal = bill.amount;
  const net = bill.total;

  return (
    <>
      {/* Top bar */}
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid var(--line)" }}>
        <Link href="/billing" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] hover:text-[color:var(--ink)] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider">Invoice</div>
          <div className="text-[17px] font-medium text-[color:var(--ink)] leading-tight">{bill.billNumber}</div>
        </div>
        <StatusBadge status={bill.status} />
        <div className="flex items-center gap-2">
          <button onClick={shareInvoice} title="Share this invoice" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] border border-[color:var(--line)] hover:bg-[color:var(--subtle)] transition-colors"><Share2 size={16} strokeWidth={1.5} /></button>
          <button onClick={downloadInvoice} title="Download a copy" className="p-2 rounded-[8px] text-[color:var(--ink-soft)] border border-[color:var(--line)] hover:bg-[color:var(--subtle)] transition-colors"><Download size={16} strokeWidth={1.5} /></button>
          <button onClick={printInvoice} className="flex items-center gap-2 text-[13px] font-normal text-white bg-[color:var(--brand)] px-4 py-2 rounded-full hover:bg-[color:var(--brand-hover)] transition-colors">
            <Printer size={14} strokeWidth={1.5} />Print
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} py-6`} style={{ maxWidth: 900 }}>
        <div ref={docRef} className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          {/* Invoice header */}
          <DocumentLetterhead
            hospital={hospital}
            right={
              <>
                <div className="text-[22px] font-medium text-[color:var(--ink)]">{bill.billNumber}</div>
                <div className="text-[13px] font-normal text-[color:var(--ink-soft)] mt-1">Date: {formatDate(bill.date)}</div>
                <div className="mt-2"><StatusBadge status={bill.status} /></div>
              </>
            }
          />

          {/* Patient info */}
          <div className="grid grid-cols-2 gap-6 p-8 pb-6" style={{ borderBottom: "1px solid var(--line)" }}>
            <div>
              <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Bill To</div>
              <div className="text-[15px] font-medium text-[color:var(--ink)]">{bill.patientName}</div>
              {patient && (
                <>
                  <div className="text-[13px] font-normal text-[color:var(--ink-soft)] mt-1">{patient.patientId ?? "—"}</div>
                  <div className="text-[13px] font-normal text-[color:var(--ink-soft)]">{patient.phone}</div>
                  <div className="mt-2"><AbhaBadge abhaId={patient.abhaId} /></div>
                </>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider mb-2">Bill Details</div>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-[color:var(--ink-soft)]">Bill Type</span>
                <span className="text-[color:var(--ink)] font-medium">{bill.type}</span>
              </div>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-[color:var(--ink-soft)]">Payment Mode</span>
                <span className="text-[color:var(--ink)]">{PAYMENT_MODE[bill.id] ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="p-8 pb-6">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-medium text-[color:var(--ink-soft)] uppercase tracking-wider" style={{ borderBottom: "1px solid var(--line)" }}>
                  <th className="text-left pb-3">#</th>
                  <th className="text-left pb-3">Description</th>
                  <th className="text-right pb-3">Qty</th>
                  <th className="text-right pb-3">Rate (₹)</th>
                  <th className="text-right pb-3">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="text-[14px]" style={{ borderBottom: "1px solid var(--subtle-2)" }}>
                    <td className="py-3 text-[color:var(--ink-soft)]">{i + 1}</td>
                    <td className="py-3 text-[color:var(--ink)]">{item.description}</td>
                    <td className="py-3 text-right text-[color:var(--ink-soft)]">{item.qty}</td>
                    <td className="py-3 text-right text-[color:var(--ink-soft)]">{item.rate.toLocaleString("en-IN")}</td>
                    <td className="py-3 text-right text-[color:var(--ink)] font-medium">{(item.qty * item.rate).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-8 pt-0 flex justify-end">
            <div className="w-64 flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[color:var(--ink-soft)]">Subtotal</span>
                <span className="text-[color:var(--ink)]">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[color:var(--ink-soft)]">Discount</span>
                  <span className="text-[#00955c]">− ₹{bill.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {bill.gst > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[color:var(--ink-soft)]">GST (9%)</span>
                  <span className="text-[color:var(--ink)]">₹{bill.gst.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="h-px bg-[color:var(--line)] my-1" />
              <div className="flex justify-between text-[15px] font-medium">
                <span className="text-[color:var(--ink)]">Total</span>
                <span className="text-[color:var(--brand)]">₹{net.toLocaleString("en-IN")}</span>
              </div>
              {bill.status === "Pending" && canWrite && (
                <button onClick={recordPayment} disabled={acting}
                  className="mt-3 w-full text-[13px] font-normal text-white bg-[color:var(--brand)] py-2 rounded-full hover:bg-[color:var(--brand-hover)] transition-colors disabled:opacity-50">
                  {acting ? "Recording…" : "Record Payment"}
                </button>
              )}
            </div>
          </div>

          {/* Footer note */}
          <DocumentFooter hospital={hospital} />
        </div>
      </div>
    </>
  );
}
