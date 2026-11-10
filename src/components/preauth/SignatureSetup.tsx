"use client";

/**
 * "My signature and stamp": a doctor keeps their signature (drawn or uploaded) and, if they have one, their stamp; the hospital's admin
 * keeps the hospital stamp. They are copied onto each form at the moment it is signed or stamped. Nobody else can see them.
 */
import { useEffect, useRef, useState } from "react";
import { Eraser, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { tw } from "@/lib/design-system";
import { SignatureUploadModal } from "@/components/preauth/SignatureUploadModal";
import type { SignatureAssetsDTO } from "@/types/preauth";

type Kind = "doctor_signature" | "doctor_stamp" | "hospital_stamp";

function DrawPad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { const c = ref.current!; const x = c.getContext("2d")!; x.lineWidth = 2.2; x.lineCap = "round"; x.strokeStyle = "#111"; }, []);
  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height }; };
  const down = (e: React.PointerEvent) => { drawing.current = true; ref.current!.setPointerCapture(e.pointerId); const x = ref.current!.getContext("2d")!; const p = pos(e); x.beginPath(); x.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const x = ref.current!.getContext("2d")!; const p = pos(e); x.lineTo(p.x, p.y); x.stroke(); setDirty(true); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = ref.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); setDirty(false); };
  return (
    <div className="flex flex-col gap-2">
      <canvas ref={ref} width={520} height={180} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="h-[120px] w-full max-w-[420px] touch-none rounded-[8px] border border-dashed border-[color:var(--line)] bg-white" aria-label="Draw your signature here" />
      <div className="flex gap-2">
        <button type="button" onClick={() => onSave(ref.current!.toDataURL("image/png"))} disabled={!dirty} className="rounded-full bg-[color:var(--brand)] px-4 py-[6px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">Keep this signature</button>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><Eraser size={13} /> Clear</button>
      </div>
    </div>
  );
}

function Slot({ title, hint, kind, image, onChanged, canDraw }: { title: string; hint: string; kind: Kind; image: string | null; onChanged: () => void; canDraw?: boolean }) {
  const { run, loading, error } = useMutation();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "draw">("view");
  const save = async (dataUrl: string) => { await run(() => api.put("/signature-assets", { kind, image: dataUrl })); setMode("view"); onChanged(); };
  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-[12px] border border-[color:var(--line)] p-4">
      <div><p className="text-[14px] font-medium text-[color:var(--ink)]">{title}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p></div>
      <div className="flex min-h-[90px] items-center justify-center rounded-[8px] bg-white p-2">
        {image ? <img src={image} alt={title} className="max-h-[90px] max-w-full object-contain" /> : <span className="text-[12px] text-[#888]">Nothing kept yet</span>}
      </div>
      {mode === "draw" ? <DrawPad onSave={save} /> : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setUploadOpen(true)} className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] hover:bg-[color:var(--subtle)]"><Upload size={13} /> {image ? "Replace picture" : "Upload picture"}</button>
          {canDraw && <button type="button" onClick={() => setMode("draw")} className="rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer">Draw it</button>}
          {image && <button type="button" onClick={async () => { await run(() => api.del(`/signature-assets?kind=${kind}`)); onChanged(); }} className="inline-flex items-center gap-1 rounded-full px-3 py-[6px] text-[13px] text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer"><Trash2 size={13} /> Remove</button>}
        </div>
      )}
      {mode === "draw" && <button type="button" onClick={() => setMode("view")} className="self-start text-[12px] text-[color:var(--ink-soft)] underline cursor-pointer">Cancel</button>}
      {loading && <p className="text-[12px] text-[color:var(--ink-soft)]">Saving…</p>}
      {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[12px] text-[#c8001a]">{error.message}</p>}
      <SignatureUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} title={`Upload ${title.toLowerCase()}`} isStamp={kind !== "doctor_signature"} onSave={save} />
    </div>
  );
}

const AUTO_SIGN_WARNING = [
  "Turn on automatic signing?",
  "From now on, every pre-auth form sent to you is signed with your saved signature straight away, without you checking it first. You will get a notification each time, and you can turn this off whenever you like.",
  "Forms already waiting for you are not signed automatically.",
].join("\n\n");

/** The doctor's switch for signing pre-auth forms automatically. */
export function AutoSign({ enabled, hasSignature, onChanged }: { enabled: boolean; hasSignature: boolean; onChanged: () => void }) {
  const { run, loading, error } = useMutation();
  const set = async (on: boolean) => {
    if (on && !confirm(AUTO_SIGN_WARNING)) return;
    try { await run(() => api.put("/signature-assets/auto-sign", { enabled: on })); onChanged(); } catch { /* shown below */ }
  };
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[color:var(--line)] p-4">
      <div className="min-w-[220px] flex-1">
        <p className="text-[14px] font-medium text-[color:var(--ink)]">Sign pre-auth forms automatically</p>
        <p className="text-[12px] text-[color:var(--ink-soft)]">
          {enabled ? "On: forms sent to you are signed with your saved signature as soon as they arrive. You are notified each time." : hasSignature ? "Off: you sign each form yourself. Turn this on and forms sent to you are signed for you, and you are only notified." : "Save your signature first, then you can turn this on."}
        </p>
        {error && <p className="mt-1 text-[12px] text-[#c8001a]">{error.message}</p>}
      </div>
      <button type="button" role="switch" aria-checked={enabled} aria-label="Sign pre-auth forms automatically" disabled={loading || (!enabled && !hasSignature)} onClick={() => void set(!enabled)}
        className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${enabled ? "bg-[color:var(--brand)]" : "bg-[#c9ced6]"}`}>
        <span className={`absolute top-[3px] h-[20px] w-[20px] rounded-full bg-white shadow transition-all ${enabled ? "left-[23px]" : "left-[3px]"}`} />
      </button>
    </div>
  );
}

/** Shown only to doctors and to the hospital's admin; anyone else has nothing to keep. */
export function SignatureSetup() {
  const { user } = useAuth();
  const { item, reload } = useItem<SignatureAssetsDTO>(user?.role === "Doctor" || user?.role === "Super Admin" ? "/signature-assets" : null);
  if (!user || (user.role !== "Doctor" && user.role !== "Super Admin")) return null;
  const a = item ?? { doctorSignature: null, doctorStamp: null, hospitalStamp: null, autoSign: false };
  return (
    <div id="signature-setup" className={`${tw.surface.card} ${tw.radius.card} scroll-mt-4 p-5`}>
      <p className="text-[15px] font-medium text-[color:var(--ink)]">My signature and stamp</p>
      <p className="mb-3 text-[12px] text-[color:var(--ink-soft)]">Kept once, then put on each pre-auth form when you sign it. Only you can see them.</p>
      <div className="flex flex-wrap gap-4">
        {user.role === "Doctor" && <>
          <Slot title="Signature" hint="Draw it or upload a clear photo on white paper." kind="doctor_signature" image={a.doctorSignature} onChanged={reload} canDraw />
          <Slot title="Doctor's stamp (optional)" hint="Your name and registration number stamp, if you use one." kind="doctor_stamp" image={a.doctorStamp} onChanged={reload} />
        </>}
        {user.role === "Super Admin" && <Slot title="Hospital stamp" hint="The hospital's seal that goes on every pre-auth form after the doctor signs." kind="hospital_stamp" image={a.hospitalStamp} onChanged={reload} />}
      </div>
      {user.role === "Doctor" && <AutoSign enabled={a.autoSign} hasSignature={!!a.doctorSignature} onChanged={reload} />}
    </div>
  );
}
