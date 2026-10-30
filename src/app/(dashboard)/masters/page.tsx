"use client";

/**
 * Setup → Masters: the hospital's service catalogue and pricing, payers, registration lists, organization, clinical forms and
 * facility. The section is kept in the URL (?section=rate_plans) so a link opens the right list.
 */
import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Layers, Search } from "lucide-react";
import { tw } from "@/lib/design-system";
import { useAuth } from "@/lib/auth-context";
import { ServicesView, TaxView } from "@/components/setup/CatalogViews";
import { RatePlansView } from "@/components/setup/RatePlanViews";
import { PackagesView } from "@/components/setup/PackageViews";
import { SponsorsView } from "@/components/setup/SponsorViews";
import { PaymentsView, PayoutRulesView, ReferralsView } from "@/components/setup/PaymentViews";
import { IdFormatsView, ClinicalFormsView } from "@/components/setup/IdFormatViews";
import { DepartmentsView, SIMPLE_SPECS, SimpleMasterView } from "@/components/setup/SimpleMasters";

const NAV: { group: string; items: [id: string, label: string][] }[] = [
  { group: "Catalog & pricing", items: [["services", "Services"], ["rate_plans", "Rate plans"], ["packages", "Packages"], ["tax", "Tax & GST"]] },
  { group: "Billing & payers", items: [["sponsors", "Sponsors & contracts"], ["rate_plan_types", "Payer classes"], ["payments", "Payments & banks"], ["payout_rules", "Payout rules"]] },
  { group: "Registration", items: [["patient_categories", "Patient categories"], ["visit_purposes", "Visit purposes"], ["arrival_statuses", "Arrival statuses"], ["income_groups", "Income groups"], ["referrals", "Referral sources"]] },
  { group: "Organization", items: [["departments", "Departments"], ["specialties", "Specialties"], ["org_units", "Org units"], ["human_ids", "ID formats"]] },
  { group: "Clinical", items: [["clinical_forms", "Clinical forms"]] },
  { group: "Facility", items: [["ward_classes", "Ward classes"], ["consulting_rooms", "Consulting rooms"], ["facility_areas", "Facility areas"], ["service_collection_centers", "Collection centers"], ["collection_centers", "Lab collection centers"], ["drug_racks", "Drug racks"]] },
];
const IDS = NAV.flatMap((g) => g.items.map((i) => i[0]));

function Section({ id }: { id: string }) {
  switch (id) {
    case "services": return <ServicesView />;
    case "rate_plans": return <RatePlansView />;
    case "packages": return <PackagesView />;
    case "tax": return <TaxView />;
    case "sponsors": return <SponsorsView />;
    case "payments": return <PaymentsView />;
    case "payout_rules": return <PayoutRulesView />;
    case "referrals": return <ReferralsView />;
    case "departments": return <DepartmentsView />;
    case "human_ids": return <IdFormatsView />;
    case "clinical_forms": return <ClinicalFormsView />;
    default: return id in SIMPLE_SPECS ? <SimpleMasterView key={id} section={id} /> : null;
  }
}

function MastersPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { can, loading } = useAuth();
  const [find, setFind] = useState("");
  const requested = params.get("section") ?? "";
  const section = IDS.includes(requested) ? requested : "services";
  const f = find.trim().toLowerCase();
  const nav = useMemo(() => NAV.map((g) => ({ ...g, items: g.items.filter(([, label]) => !f || label.toLowerCase().includes(f)) })).filter((g) => g.items.length > 0), [f]);

  if (loading) return null;
  if (!can("admin", "read")) {
    return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Masters are managed by hospital administrators.</p></div>;
  }
  return (
    <div className={`${tw.gutterX} pt-[16px] mb-[30px]`}>
      <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 520 }}>
        <div className="flex items-baseline gap-3 border-b border-[color:var(--line)] px-5 py-3">
          <Layers size={16} className="self-center text-[color:var(--ink-soft)]" />
          <h1 className="text-[15px] font-semibold text-[color:var(--ink)]">Masters</h1>
          <span className="text-[13px] text-[color:var(--ink-soft)]">Service catalog, organization &amp; facility configuration</span>
        </div>
        <div className="flex items-start">
          <aside className="w-[210px] shrink-0 border-r border-[color:var(--line)] px-3 py-3 text-[14px]" style={{ minHeight: 460 }}>
            <div className="relative mb-3">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
              <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a master…" aria-label="Find a master"
                className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-8 pr-2 text-[13px] focus:border-[color:var(--brand)] focus:outline-none" />
            </div>
            {nav.map((g) => (
              <div key={g.group} className="mb-3">
                <p className="px-2 pb-1 text-[11px] text-[color:var(--ink-soft)]">{g.group}</p>
                {g.items.map(([id, label]) => (
                  <button key={id} onClick={() => router.replace(`/masters?section=${id}`)} aria-current={section === id ? "page" : undefined}
                    className={`block w-full rounded-[8px] px-2 py-[6px] text-left cursor-pointer ${section === id ? "bg-[color:var(--subtle)] font-medium text-[color:var(--ink)]" : "text-[color:var(--ink-soft)] hover:bg-[color:var(--faint)] hover:text-[color:var(--ink)]"}`}>{label}</button>
                ))}
              </div>
            ))}
            {nav.length === 0 && <p className="px-2 text-[13px] text-[color:var(--ink-soft)]">No master matches.</p>}
          </aside>
          <div className="min-w-0 flex-1 px-5 py-4"><Section id={section} /></div>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense fallback={null}><MastersPage /></Suspense>;
}
