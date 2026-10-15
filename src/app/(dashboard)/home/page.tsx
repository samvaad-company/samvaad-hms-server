"use client";

/**
 * Role home — routes the logged-in user to their role's panel.
 */
import { useAuth } from "@/lib/auth-context";
import { tw } from "@/lib/design-system";
import { DoctorPanel } from "@/components/panels/DoctorPanel";
import { ReceptionistPanel } from "@/components/panels/ReceptionistPanel";
import { NursePanel } from "@/components/panels/NursePanel";
import { PharmacistPanel } from "@/components/panels/PharmacistPanel";
import { LabPanel } from "@/components/panels/LabPanel";
import { BillingPanel } from "@/components/panels/BillingPanel";
import { DriverPanel } from "@/components/panels/DriverPanel";
import { ItAdminPanel } from "@/components/panels/ItAdminPanel";
import { AdminPanel } from "@/components/panels/AdminPanel";
import { TeleCallerPanel } from "@/components/panels/TeleCallerPanel";

const ROLE_PANELS: Record<string, () => React.JSX.Element> = {
  "Doctor": DoctorPanel,
  "Receptionist": ReceptionistPanel,
  "Head Nurse": NursePanel,
  "Pharmacist": PharmacistPanel,
  "Lab Technician": LabPanel,
  "Billing Exec": BillingPanel,
  "Driver": DriverPanel,
  "IT Admin": ItAdminPanel,
  "Tele Caller": TeleCallerPanel,
};

export default function HomePage() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return (
      <div className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>
        Loading your workspace…
      </div>
    );
  }

  // Super Admin and unknown roles get the hospital-wide overview.
  const Panel = ROLE_PANELS[user.role] ?? AdminPanel;
  return <Panel />;
}
