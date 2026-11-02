"use client";

/** Stores → Dispense: the pharmacy dispensing counter. */
import Link from "next/link";
import { PillBottle } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { DispenseScreen } from "@/components/dispense/DispenseScreen";

export default function DispensePage() {
  const { can, loading } = useAuth();
  if (loading) return null;
  if (!can("pharmacy", "read")) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">The dispensing counter is for pharmacy staff.</p></div>;
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 560 }}>
        <div className="flex items-center gap-3 px-5 pt-3">
          <PillBottle size={16} className="text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Pharmacy</h1>
        </div>
        <nav aria-label="Pharmacy" className="flex flex-wrap gap-5 max-lg:gap-2 border-b border-[color:var(--line)] px-4 sm:px-5 pt-2 max-lg:pb-3 text-[14px]">
          <Link href="/pharmacy" className="border-b-2 border-transparent pb-2 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] max-lg:rounded-full max-lg:border max-lg:border-[color:var(--line)] max-lg:px-3 max-lg:py-[7px]">Inventory</Link>
          <span aria-current="page" className="border-b-2 border-[color:var(--brand)] pb-2 font-medium text-[color:var(--ink)] max-lg:rounded-full max-lg:border max-lg:bg-[color:var(--brand-soft)] max-lg:px-3 max-lg:py-[7px]">Dispense</span>
        </nav>
        <DispenseScreen />
      </div>
    </div>
  );
}
