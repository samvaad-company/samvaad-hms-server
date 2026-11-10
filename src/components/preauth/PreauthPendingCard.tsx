"use client";

/**
 * On the home dashboard of a doctor (forms to sign) and of the hospital's admin (forms to stamp): every pre-auth form waiting on them,
 * one line per patient, with the action right there. Shows nothing when there is nothing waiting.
 */
import { useRouter } from "next/navigation";
import { PenLine, Stamp } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import type { PreauthPendingDTO, PreauthSummaryDTO, SignatureAssetsDTO } from "@/types/preauth";
import { PatientName } from "@/components/loyalty/PatientName";

export function PreauthPendingCard() {
  const { user } = useAuth();
  const router = useRouter();
  const eligible = !!user?.hospitalId && (user.role === "Doctor" || user.role === "Super Admin");
  const { item, reload } = useItem<PreauthPendingDTO>(eligible ? "/preauth/pending" : null);
  const { item: assets } = useItem<SignatureAssetsDTO>(eligible ? "/signature-assets" : null);
  const { run, loading, error } = useMutation();
  if (!eligible || !item) return null;

  const rows: { f: PreauthSummaryDTO; kind: "sign" | "stamp" }[] = [...item.toSign.map((f) => ({ f, kind: "sign" as const })), ...item.toStamp.map((f) => ({ f, kind: "stamp" as const }))];
  if (rows.length === 0) return null;
  const ready = (kind: "sign" | "stamp") => (kind === "sign" ? !!assets?.doctorSignature : !!assets?.hospitalStamp);

  return (
    <div className={`${tw.gutterX} mb-4`}>
      <div className={`${tw.surface.card} ${tw.radius.card} border-l-4 border-l-[#ff9000] p-4`} data-testid="preauth-pending">
        <p className="text-[15px] font-medium text-[color:var(--ink)]">Pre-auth forms waiting for you <span className="ml-1 rounded-full bg-[#fff2e0] px-2 py-[1px] text-[12px] text-[#a85a00]">{rows.length}</span></p>
        <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">{user?.role === "Doctor" ? "Each needs your signature before the hospital can stamp it." : "The doctor has signed these; they need the hospital stamp."}</p>
        <ul className="flex flex-col">
          {rows.map(({ f, kind }) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 border-t border-[color:var(--subtle-2)] py-[10px] first:border-t-0">
              <button type="button" onClick={() => router.push(`/preauth/${f.id}`)} className="min-w-0 flex-1 cursor-pointer text-left">
                <span className="block truncate text-[14px] font-medium text-[color:var(--ink)]"><PatientName id={f.patientId} name={f.patientName} /></span>
                <span className="block truncate text-[12px] text-[color:var(--ink-soft)]">{f.formName}{kind === "stamp" && f.doctorName ? ` · signed by ${f.doctorName}` : ""}</span>
              </button>
              <button type="button" onClick={() => router.push(`/preauth/${f.id}`)} className="cursor-pointer rounded-full border border-[color:var(--line)] px-3 py-[5px] text-[12px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]">Review</button>
              <button type="button" disabled={loading || !ready(kind)} title={ready(kind) ? "" : kind === "sign" ? "Add your signature on the Pre-auth forms page first" : "Add the hospital stamp on the Pre-auth forms page first"}
                onClick={async () => { await run(() => api.post(`/preauth/${f.id}/${kind}`, {})); reload(); }}
                className="inline-flex cursor-pointer items-center gap-[6px] rounded-full bg-[color:var(--brand)] px-4 py-[5px] text-[12px] text-white hover:bg-[color:var(--brand-hover)] disabled:cursor-not-allowed disabled:opacity-50">
                {kind === "sign" ? <PenLine size={13} /> : <Stamp size={13} />} {kind === "sign" ? "Sign" : "Stamp"}
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="mt-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[12px] text-[#c8001a]">{error.message}</p>}
        {!ready(rows[0].kind) && <p className="mt-2 text-[12px] text-[color:var(--ink-soft)]">{user?.role === "Doctor" ? "You haven't added your signature yet: do it on the Pre-auth forms page." : "You haven't added the hospital stamp yet: do it on the Pre-auth forms page."}</p>}
      </div>
    </div>
  );
}
