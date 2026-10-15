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
  // Only the first patient is needed (same order as the list), not everyone.
  const { items: firstPage, loading } = useList<PatientDTO>("/patients", { page: 1, pageSize: 1, sort: "name:asc" });
  const first = firstPage[0] ?? null;

  useEffect(() => {
    if (first && window.matchMedia("(min-width: 768px)").matches) router.replace(`/patients/${first.id}`);
  }, [first, router]);

  if (loading || first) return null;
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-[color:var(--ink-soft)]">
      <Users size={40} strokeWidth={1} className="opacity-30" />
      <p className="text-[14px]">No patients yet.</p>
      {can("patients", "write") && (
        <Link href="/patients/new" className="text-[13px] text-white bg-[color:var(--brand)] px-5 py-[8px] rounded-full hover:bg-[color:var(--brand-hover)]">Register the first patient</Link>
      )}
    </div>
  );
}
