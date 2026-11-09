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
import type { SignatureAssetsDTO } from "@/types/preauth";

type Kind = "doctor_signature" | "doctor_stamp" | "hospital_stamp";

/** Shrinks a chosen picture to at most 520px wide and returns it as a PNG data URL, small enough to keep. */
async function fileToImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't a picture.")); i.src = url; });
    const scale = Math.min(1, 520 / img.width);
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

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
  const [localError, setLocalError] = useState("");
  const [mode, setMode] = useState<"view" | "draw">("view");
  const save = async (dataUrl: string) => { await run(() => api.put("/signature-assets", { kind, image: dataUrl })); setMode("view"); onChanged(); };
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setLocalError("");
    try { await save(await fileToImage(f)); } catch (e) { setLocalError(e instanceof Error ? e.message : "Couldn't read that picture."); }
  };
  return (
    <div className="flex min-w-[260px] flex-1 flex-col gap-2 rounded-[12px] border border-[color:var(--line)] p-4">
      <div><p className="text-[14px] font-medium text-[color:var(--ink)]">{title}</p><p className="text-[12px] text-[color:var(--ink-soft)]">{hint}</p></div>
      <div className="flex min-h-[90px] items-center justify-center rounded-[8px] bg-white p-2">
        {image ? <img src={image} alt={title} className="max-h-[90px] max-w-full object-contain" /> : <span className="text-[12px] text-[#888]">Nothing kept yet</span>}
      </div>
      {mode === "draw" ? <DrawPad onSave={save} /> : (
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] hover:bg-[color:var(--subtle)]">
            <Upload size={13} /> {image ? "Replace picture" : "Upload picture"}
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          {canDraw && <button type="button" onClick={() => setMode("draw")} className="rounded-full border border-[color:var(--line)] px-4 py-[6px] text-[13px] hover:bg-[color:var(--subtle)] cursor-pointer">Draw it</button>}
          {image && <button type="button" onClick={async () => { await run(() => api.del(`/signature-assets?kind=${kind}`)); onChanged(); }} className="inline-flex items-center gap-1 rounded-full px-3 py-[6px] text-[13px] text-[#c8001a] hover:bg-[#ffe9e9] cursor-pointer"><Trash2 size={13} /> Remove</button>}
        </div>
      )}
      {mode === "draw" && <button type="button" onClick={() => setMode("view")} className="self-start text-[12px] text-[color:var(--ink-soft)] underline cursor-pointer">Cancel</button>}
      {loading && <p className="text-[12px] text-[color:var(--ink-soft)]">Saving…</p>}
      {(error || localError) && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[12px] text-[#c8001a]">{localError || error?.message}</p>}
    </div>
  );
}

/** Shown only to doctors and to the hospital's admin; anyone else has nothing to keep. */
export function SignatureSetup() {
  const { user } = useAuth();
  const { item, reload } = useItem<SignatureAssetsDTO>(user?.role === "Doctor" || user?.role === "Super Admin" ? "/signature-assets" : null);
  if (!user || (user.role !== "Doctor" && user.role !== "Super Admin")) return null;
  const a = item ?? { doctorSignature: null, doctorStamp: null, hospitalStamp: null };
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
    </div>
  );
}
