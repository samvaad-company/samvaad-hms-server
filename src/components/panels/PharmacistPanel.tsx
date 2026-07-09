"use client";

/**
 * Pharmacist home panel — dispensing worklist (pending prescriptions) and
 * stock alerts (low / out-of-stock / expired items).
 */
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { PrescriptionDTO, PharmacyItemDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Pill, FileText, AlertTriangle, PackageX } from "lucide-react";
import { tw } from "@/lib/design-system";
import { PanelHeader, StatRow, QuickLinks, WorklistCard, EmptyRow } from "./shared";

export function PharmacistPanel() {
  const { user } = useAuth();
  const { items: prescriptions } = useList<PrescriptionDTO>("/prescriptions", { all: true });
  const { items: stock } = useList<PharmacyItemDTO>("/pharmacy", { all: true });

  const pending = prescriptions.filter(p => p.status === "Pending");
  const alerts = stock.filter(i => i.status !== "In Stock");
  const outOfStock = stock.filter(i => i.status === "Out of Stock" || i.status === "Expired").length;

  return (
    <>
      <PanelHeader name={user?.name ?? "Pharmacist"} subtitle="Dispensary · Pharmacy Panel" badge="Pharmacy Open" />

      <StatRow stats={[
        { icon: FileText,      label: "Pending Dispense",  value: String(pending.length),  color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: Pill,          label: "Items in Stock",    value: String(stock.length),    color: "text-[#11111c]", bg: "bg-[#f0f0f0]" },
        { icon: AlertTriangle, label: "Stock Alerts",      value: String(alerts.length),   color: "text-[#ff9000]", bg: "bg-[#fff2e0]" },
        { icon: PackageX,      label: "Out / Expired",     value: String(outOfStock),      color: "text-[#ff0004]", bg: "bg-[#ffe9e9]" },
      ]} />

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className="flex gap-5 items-start">
          <WorklistCard title="Prescriptions to Dispense" action={{ label: "All prescriptions", href: "/prescriptions" }}>
            <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
              {pending.length === 0 ? (
                <EmptyRow text="Nothing pending — all caught up." />
              ) : pending.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0] hover:bg-[#fafafa]">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] font-medium text-[#11111c] truncate">{p.patientName}</span>
                    <span className="text-[11px] font-light text-[#57575f]">{p.rxNumber} · {p.medicineCount} medicines · {p.doctor}</span>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          </WorklistCard>

          <div className="flex flex-col gap-4 shrink-0" style={{ width: 380 }}>
            <WorklistCard title="Stock Alerts" action={{ label: "Inventory", href: "/pharmacy" }}>
              <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                {alerts.length === 0 ? (
                  <EmptyRow text="No stock alerts." />
                ) : alerts.map(i => (
                  <div key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#f0f0f0]">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[13px] font-medium text-[#11111c] truncate">{i.name}</span>
                      <span className="text-[11px] font-light text-[#57575f]">{i.stock} left · min {i.minStock}</span>
                    </div>
                    <StatusBadge status={i.status} />
                  </div>
                ))}
              </div>
            </WorklistCard>

            <QuickLinks links={[
              { href: "/pharmacy",      label: "Pharmacy Desk",  description: "Stock, sales & orders",   icon: Pill },
              { href: "/prescriptions", label: "Prescriptions",  description: "Dispense queue",          icon: FileText },
            ]} />
          </div>
        </div>
      </div>
    </>
  );
}
