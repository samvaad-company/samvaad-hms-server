"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users } from "lucide-react";
import { useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { PatientDTO } from "@/types/api";

/**
 * /patients: on a tablet or wider screen, open the first patient (alphabetically) so the right side is never
 * empty; on a phone-width screen the list is the page. The list itself lives in layout.tsx.
 */
export default function PatientsIndexPage() {
  const router = useRouter();
  const { can } = useAuth();
  const { items: patients, loading } = useList<PatientDTO>("/patients", { all: true });
  const first = patients.length ? patients.reduce((a, b) => (a.name.localeCompare(b.name) <= 0 ? a : b)) : null;

  useEffect(() => {
    if (first && window.matchMedia("(min-width: 768px)").matches) router.replace(`/patients/${first.id}`);
  }, [first, router]);

  if (loading || first) return null;
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-[#57575f]">
      <Users size={40} strokeWidth={1} className="opacity-30" />
      <p className="text-[14px]">No patients yet.</p>
      {can("patients", "write") && (
        <Link href="/patients/new" className="text-[13px] text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82]">Register the first patient</Link>
      )}
    </div>
  );
}
