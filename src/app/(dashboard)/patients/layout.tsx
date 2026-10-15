"use client";

import { usePathname } from "next/navigation";
import { PatientListPane } from "@/components/patients/PatientListPane";

/**
 * Patients: the list on the left, the selected patient on the right. The layout stays mounted
 * while you move between patients, so the list keeps its scroll, search and filter. On phone-width
 * screens only one side shows at a time (the list, or the patient you opened).
 * Registering a new patient (/patients/new) is a full-screen form: only the app sidebar stays.
 */
export default function PatientsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/patients/new") return <>{children}</>; // full-screen registration (sidebar only)
  const hasPatient = pathname !== "/patients";

  return (
    <div className="flex h-full">
      <PatientListPane className={`${hasPatient ? "hidden md:flex" : "flex"} w-full md:w-[260px] lg:w-[320px] md:shrink-0`} />
      <section className={`${hasPatient ? "block" : "hidden md:block"} flex-1 min-w-0 overflow-y-auto`}>{children}</section>
    </div>
  );
}
