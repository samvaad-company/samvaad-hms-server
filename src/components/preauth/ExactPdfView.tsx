"use client";

/** The insurer's own form with the details printed in its boxes: what is sent to the insurer. Refreshes as the details change. */
import { useEffect, useRef, useState } from "react";
import { buildExactPdf } from "@/lib/preauth/exact";
import type { PreauthDTO, PreauthValues } from "@/types/preauth";

export function ExactPdfView({ form, values }: { form: PreauthDTO; values: PreauthValues }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const last = useRef<string | null>(null);

  useEffect(() => {
    let dead = false;
    const t = setTimeout(async () => {
      try {
        const blob = await buildExactPdf(form, values);
        if (dead) return;
        const u = URL.createObjectURL(blob);
        if (last.current) URL.revokeObjectURL(last.current);
        last.current = u; setUrl(u); setError("");
      } catch (e) { if (!dead) setError(e instanceof Error ? e.message : "Couldn't prepare the form."); }
    }, 350);
    return () => { dead = true; clearTimeout(t); };
  }, [form, values]);
  useEffect(() => () => { if (last.current) URL.revokeObjectURL(last.current); }, []);

  if (error) return <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error}</p>;
  if (!url) return <p className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">Preparing the insurer&apos;s form…</p>;
  return (
    <>
      {/* Phones can't scroll or zoom a PDF shown inside a page, so there it opens in the phone's own PDF viewer instead. */}
      <iframe title="Insurer's form" src={url} className="hidden h-[85vh] w-full rounded-[8px] border border-[color:var(--line)] bg-white md:block" />
      <div className="flex flex-col gap-3 rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] p-4 md:hidden">
        <p className="text-[13px] text-[color:var(--ink)]">The insurer&apos;s form is ready. Open it in your phone&apos;s PDF viewer to scroll and zoom, or save it.</p>
        <div className="flex flex-wrap gap-2">
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex h-[38px] items-center rounded-full bg-[color:var(--brand)] px-5 text-[13px] text-white">Open the form</a>
          <a href={url} download={`${form.formName} - ${form.patientName}.pdf`} className="inline-flex h-[38px] items-center rounded-full border border-[color:var(--line)] px-5 text-[13px] text-[color:var(--ink)]">Download</a>
        </div>
      </div>
    </>
  );
}
