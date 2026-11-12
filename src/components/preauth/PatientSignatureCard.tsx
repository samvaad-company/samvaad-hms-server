"use client";

/**
 * The patient's (or insured's) signature on a pre-auth form: drawn on the screen with a finger, stylus or mouse, or uploaded from a
 * picture of their signature. It is kept on this one form and printed at every "Patient / Insured signature" place on the insurer's PDF.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import type { PreauthDTO } from "@/types/preauth";
import { Modal } from "@/components/shared/Modal";
import { SignatureUploadModal } from "@/components/preauth/SignatureUploadModal";

const PAD_W = 640, PAD_H = 240, INK = "#0b1f6b";
const CHECKER = "repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%) 50% / 16px 16px";
const MAX_CHARS = 440_000;

/** Crops the drawing to its ink, with a little room round it, so the signature fills its place on the form. */
function trimmed(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return null;
  const pad = 8;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext("2d")?.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

function DrawModal({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (dataUrl: string) => Promise<void> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const clear = useCallback(() => {
    const c = ref.current;
    c?.getContext("2d")?.clearRect(0, 0, PAD_W, PAD_H);
    setEmpty(true); setError("");
  }, []);
  useEffect(() => { if (open) { setSaving(false); requestAnimationFrame(clear); } }, [open, clear]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PAD_W, y: ((e.clientY - r.top) / r.height) * PAD_H };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = point(e); last.current = p;
    const ctx = e.currentTarget.getContext("2d");
    if (ctx) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill(); }
    setEmpty(false);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    // Pressure from a stylus makes the line a little thicker, as a pen would.
    ctx.lineWidth = e.pointerType === "pen" && e.pressure > 0 ? 1.5 + e.pressure * 2.5 : 2.6;
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; };

  async function save() {
    const c = ref.current;
    const url = c ? trimmed(c) : null;
    if (!url) { setError("Draw the signature first."); return; }
    if (url.length > MAX_CHARS) { setError("That signature is too large — draw it a little smaller."); return; }
    setSaving(true);
    try { await onSave(url); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Couldn't save the signature."); } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} width={720} title="Patient's signature" subtitle="Ask the patient or their representative to sign in the box below, with a finger, a stylus or the mouse."
      footer={<>
        <button onClick={onClose} className="rounded-full border border-[color:var(--line)] px-5 py-[8px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
        <button onClick={clear} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-5 py-[8px] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer"><Eraser size={13} /> Clear</button>
        <button onClick={save} disabled={empty || saving} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{saving ? "Saving…" : "Use this signature"}</button>
      </>}>
      <div className="flex flex-col gap-2">
        <div className="relative overflow-hidden rounded-[10px] border border-[color:var(--line)] bg-white" style={{ touchAction: "none" }}>
          <canvas ref={ref} width={PAD_W} height={PAD_H} aria-label="Signature pad" className="block w-full cursor-crosshair"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
          <span className="pointer-events-none absolute bottom-[34px] left-[6%] right-[6%] border-t border-dashed border-[#c9c9c9]" />
          <span className="pointer-events-none absolute bottom-[10px] left-[6%] text-[11px] text-[#9a9a9a]">Sign above the line</span>
        </div>
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error}</p>}
      </div>
    </Modal>
  );
}

export function PatientSignatureCard({ form, canEdit, onChanged }: { form: PreauthDTO; canEdit: boolean; onChanged: () => void }) {
  const [draw, setDraw] = useState(false);
  const [upload, setUpload] = useState(false);
  const { run, loading, error, reset } = useMutation();

  async function put(image: string | null) {
    reset();
    await run(() => api.put(`/preauth/${form.id}/patient-signature`, { image }));
    onChanged();
  }

  return (
    <section className="rounded-[12px] border border-[color:var(--line)] bg-[color:var(--surface)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <div className="min-w-[220px] flex-1 basis-[220px]">
          <h3 className="text-[13px] font-semibold text-[color:var(--ink)]">Patient&apos;s signature</h3>
          <p className="text-[12px] text-[color:var(--ink-soft)]">
            {form.patientSignatureImg
              ? `Added${form.patientSignedBy ? ` by ${form.patientSignedBy}` : ""}${form.patientSignedAt ? ` on ${new Date(form.patientSignedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })}` : ""}. It is printed at each patient / insured signature place on the insurer's form.`
              : "Not added yet. Draw it on the screen or upload a picture of it; it is printed at each patient / insured signature place on the insurer's form."}
          </p>
        </div>
        {form.patientSignatureImg && (
          <div className="rounded-[8px] border border-[color:var(--line)] px-2 py-1" style={{ background: CHECKER }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={form.patientSignatureImg} alt="Patient's signature" className="max-h-[56px] max-w-[200px] object-contain" />
          </div>
        )}
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setDraw(true)} disabled={loading} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] disabled:opacity-50 cursor-pointer"><PenLine size={13} /> {form.patientSignatureImg ? "Sign again" : "Draw signature"}</button>
            <button type="button" onClick={() => setUpload(true)} disabled={loading} className="inline-flex items-center gap-1 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[color:var(--ink)] hover:bg-[color:var(--subtle)] disabled:opacity-50 cursor-pointer"><Upload size={13} /> Upload picture</button>
            {form.patientSignatureImg && <button type="button" onClick={() => put(null)} disabled={loading} className="inline-flex items-center gap-1 rounded-full px-3 py-[7px] text-[13px] text-[#c8001a] hover:bg-[#ffe9e9] disabled:opacity-50 cursor-pointer"><Trash2 size={13} /> Remove</button>}
          </div>
        )}
      </div>
      {error && <p role="alert" className="mt-2 rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
      <DrawModal open={draw} onClose={() => setDraw(false)} onSave={(url) => put(url)} />
      <SignatureUploadModal open={upload} onClose={() => setUpload(false)} title="Patient's signature" onSave={(url) => put(url)} />
    </section>
  );
}
