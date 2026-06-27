"use client";

import { useParams } from "next/navigation";
import { tw } from "@/lib/design-system";
import { ArrowLeft, Printer, Download, Share2, Building2 } from "lucide-react";
import { bills } from "@/data/billing";
import { patients } from "@/data/patients";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
  const bill = bills.find(b => b.id === Number(id));

  if (!bill) {
    return (
      <div className={`${tw.gutterX} py-20 text-center text-[#57575f]`}>
        Invoice not found.{" "}
        <Link href="/billing" className="text-[#009598] underline">Back to Billing</Link>
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
      <div className={`${tw.gutterX} py-5 flex items-center gap-4`} style={{ borderBottom: "1px solid #dedee1" }}>
        <Link href="/billing" className="p-2 rounded-[8px] text-[#57575f] hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors">
          <ArrowLeft size={20} strokeWidth={1.5} />
        </Link>
        <div className="flex-1">
          <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Invoice</div>
          <div className="text-[17px] font-medium text-[#11111c] leading-tight">{bill.billNumber}</div>
        </div>
        <StatusBadge status={bill.status} />
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-[8px] text-[#57575f] border border-[#dedee1] hover:bg-[#f6f6f6] transition-colors"><Share2 size={16} strokeWidth={1.5} /></button>
          <button className="p-2 rounded-[8px] text-[#57575f] border border-[#dedee1] hover:bg-[#f6f6f6] transition-colors"><Download size={16} strokeWidth={1.5} /></button>
          <button className="flex items-center gap-2 text-[13px] font-normal text-white bg-[#009598] px-4 py-2 rounded-full hover:bg-[#007f82] transition-colors">
            <Printer size={14} strokeWidth={1.5} />Print
          </button>
        </div>
      </div>

      <div className={`${tw.gutterX} py-6`} style={{ maxWidth: 900 }}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
          {/* Invoice header */}
          <div className="flex items-start justify-between p-8 pb-6" style={{ borderBottom: "1px solid #dedee1" }}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-[10px] bg-[#009598] flex items-center justify-center">
                <Building2 size={22} strokeWidth={1.5} className="text-white" />
              </div>
              <div>
                <div className="text-[17px] font-medium text-[#11111c]">Samvaad Hospital</div>
                <div className="text-[12px] font-light text-[#57575f]">123 Health Street, Medical City · GST: 27AAAPL1234F1ZE</div>
                <div className="text-[12px] font-light text-[#57575f]">+91 22 4567 8900 · samvaadhospital.in</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[22px] font-medium text-[#11111c]">{bill.billNumber}</div>
              <div className="text-[13px] font-normal text-[#57575f] mt-1">Date: {bill.date}</div>
              <div className="mt-2"><StatusBadge status={bill.status} /></div>
            </div>
          </div>

          {/* Patient info */}
          <div className="grid grid-cols-2 gap-6 p-8 pb-6" style={{ borderBottom: "1px solid #dedee1" }}>
            <div>
              <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Bill To</div>
              <div className="text-[15px] font-medium text-[#11111c]">{bill.patientName}</div>
              {patient && (
                <>
                  <div className="text-[13px] font-normal text-[#57575f] mt-1">{patient.patientId ?? "—"}</div>
                  <div className="text-[13px] font-normal text-[#57575f]">{patient.phone}</div>
                </>
              )}
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider mb-2">Bill Details</div>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-[#57575f]">Bill Type</span>
                <span className="text-[#11111c] font-medium">{bill.type}</span>
              </div>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-[#57575f]">Payment Mode</span>
                <span className="text-[#11111c]">{PAYMENT_MODE[bill.id] ?? "—"}</span>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="p-8 pb-6">
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider" style={{ borderBottom: "1px solid #dedee1" }}>
                  <th className="text-left pb-3">#</th>
                  <th className="text-left pb-3">Description</th>
                  <th className="text-right pb-3">Qty</th>
                  <th className="text-right pb-3">Rate (₹)</th>
                  <th className="text-right pb-3">Amount (₹)</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="text-[14px]" style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td className="py-3 text-[#57575f]">{i + 1}</td>
                    <td className="py-3 text-[#11111c]">{item.description}</td>
                    <td className="py-3 text-right text-[#57575f]">{item.qty}</td>
                    <td className="py-3 text-right text-[#57575f]">{item.rate.toLocaleString("en-IN")}</td>
                    <td className="py-3 text-right text-[#11111c] font-medium">{(item.qty * item.rate).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-8 pt-0 flex justify-end">
            <div className="w-64 flex flex-col gap-2">
              <div className="flex justify-between text-[13px]">
                <span className="text-[#57575f]">Subtotal</span>
                <span className="text-[#11111c]">₹{subtotal.toLocaleString("en-IN")}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#57575f]">Discount</span>
                  <span className="text-[#00955c]">− ₹{bill.discount.toLocaleString("en-IN")}</span>
                </div>
              )}
              {bill.gst > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-[#57575f]">GST (9%)</span>
                  <span className="text-[#11111c]">₹{bill.gst.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="h-px bg-[#dedee1] my-1" />
              <div className="flex justify-between text-[15px] font-medium">
                <span className="text-[#11111c]">Total</span>
                <span className="text-[#009598]">₹{net.toLocaleString("en-IN")}</span>
              </div>
              {bill.status === "Pending" && (
                <button className="mt-3 w-full text-[13px] font-normal text-white bg-[#009598] py-2 rounded-full hover:bg-[#007f82] transition-colors">
                  Record Payment
                </button>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="px-8 pb-8 text-[11px] font-light text-[#57575f] text-center">
            Thank you for choosing Samvaad Hospital. For queries call +91 22 4567 8900.
          </div>
        </div>
      </div>
    </>
  );
}
