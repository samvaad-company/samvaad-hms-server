"use client";

/**
 * Upload a photo or scan of a signature or stamp. The paper behind it is removed in the browser (see lib/image/remove-background) so it
 * sits cleanly on the printed form; the person checks the result on a chequered background and can nudge "remove more / keep more".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import { Modal } from "@/components/shared/Modal";
import { analyse, render, toKeepableDataUrl, type Analysis, type InkColour } from "@/lib/image/remove-background";

const CHECKER = "repeating-conic-gradient(#e6e6e6 0% 25%, #fff 0% 50%) 50% / 16px 16px";
const MAX_BYTES = 15 * 1024 * 1024;

export function SignatureUploadModal({ open, onClose, title, isStamp, onSave }: { open: boolean; onClose: () => void; title: string; isStamp?: boolean; onSave: (dataUrl: string) => Promise<void> }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [original, setOriginal] = useState("");
  const [sensitivity, setSensitivity] = useState(50);
  const [ink, setInk] = useState<InkColour>("original");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => { setAnalysis(null); setOriginal(""); setSensitivity(50); setInk("original"); setError(""); setBusy(false); setSaving(false); }, []);
  useEffect(() => { if (!open) reset(); }, [open, reset]);
  useEffect(() => () => { if (original) URL.revokeObjectURL(original); }, [original]);

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setError("");
    if (!/^image\/(png|jpe?g|webp|bmp|gif)$/.test(f.type)) { setError("Choose a picture (PNG, JPG or WebP)."); return; }
    if (f.size > MAX_BYTES) { setError("That picture is too big. Choose one under 15 MB."); return; }
    setBusy(true);
    try {
      const a = await analyse(f);
      setOriginal(URL.createObjectURL(f));
      setAnalysis(a);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read that picture."); }
    finally { setBusy(false); }
  };

  const result = useMemo(() => (analysis ? render(analysis, { sensitivity, ink: isStamp ? "original" : ink }) : null), [analysis, sensitivity, ink, isStamp]);
  const preview = useMemo(() => (result?.found ? result.canvas.toDataURL("image/png") : ""), [result]);

  const keep = async () => {
    if (!result?.found) return;
    setSaving(true); setError("");
    try { await onSave(toKeepableDataUrl(result.canvas)); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't save it."); }
    finally { setSaving(false); }
  };

  const chip = (on: boolean) => `rounded-full border px-3 py-[5px] text-[12px] cursor-pointer ${on ? "border-[color:var(--brand)] bg-[color:var(--brand)] text-white" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`;

  return (
    <Modal open={open} onClose={onClose} title={title} width={720}
      subtitle="The paper behind it is removed here on your device; nothing is uploaded until you keep it."
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {analysis && <button type="button" onClick={reset} className="rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Choose another</button>}
          <button type="button" onClick={onClose} className="rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button type="button" onClick={keep} disabled={!result?.found || saving} className="rounded-full bg-[color:var(--brand)] px-5 py-[7px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{saving ? "Saving…" : "Keep this"}</button>
        </div>
      }>
      <div className="flex flex-col gap-4 p-5">
        {!analysis && (
          <div className="rounded-[10px] border border-[#f3cf7d] bg-[#fff6dd] px-4 py-3 text-[12.5px] text-[#7a4a00] dark:border-[#5a4a1a] dark:bg-[#2a2412] dark:text-[#ffd27a]">
            <p className="mb-1 font-medium">For the cleanest result, please sign on plain white paper.</p>
            <ul className="list-disc space-y-[2px] pl-5">
              <li>Use a <b>plain white sheet</b> with no lines, grid, printing or watermark{isStamp ? ", and stamp it away from any text or signature" : ""}.</li>
              <li>Write with a <b>dark pen</b> ({isStamp ? "or a full, even stamp pad" : "black or blue, not pencil or a light gel pen"}); thicker, darker strokes come out sharper.</li>
              <li>Photograph it in <b>bright, even light</b>, with no shadow of your hand or phone across the paper.</li>
              <li>Hold the camera <b>straight above</b> the page, close enough that the {isStamp ? "stamp" : "signature"} fills most of the picture, and keep it in focus.</li>
              <li>Keep the paper <b>flat</b>, with no folds or creases. A flatbed scan works even better than a photo.</li>
              <li>Don&apos;t use a filter, flash glare or a picture of a screen. Only one {isStamp ? "stamp" : "signature"} per picture.</li>
            </ul>
          </div>
        )}
        {!analysis ? (
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); void choose(e.dataTransfer.files?.[0]); }}
            className={`flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border-2 border-dashed p-6 text-center ${drag ? "border-[color:var(--brand)] bg-[color:var(--subtle)]" : "border-[color:var(--line)]"}`}>
            <ImageUp size={28} className="text-[color:var(--ink-soft)]" />
            <span className="text-[14px] text-[color:var(--ink)]">{busy ? "Removing the background…" : "Choose a picture or drop it here"}</span>
            <span className="text-[12px] text-[color:var(--ink-soft)]">PNG, JPG or WebP</span>
            <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden" disabled={busy} onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-[12px] text-[color:var(--ink-soft)]">Your picture</p>
                <div className="flex h-[180px] items-center justify-center rounded-[10px] border border-[color:var(--line)] bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={original} alt="Your picture" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
              <div>
                <p className="mb-1 text-[12px] text-[color:var(--ink-soft)]">Background removed</p>
                <div className="flex h-[180px] items-center justify-center rounded-[10px] border border-[color:var(--line)] p-2" style={{ background: CHECKER }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {preview ? <img src={preview} alt="Background removed" className="max-h-full max-w-full object-contain" /> : <span className="rounded bg-white/90 px-2 py-1 text-[12px] text-[#7a4a00]">No writing found. Try &quot;keep more&quot; or a clearer picture.</span>}
                </div>
              </div>
            </div>

            {analysis.alreadyTransparent && <p className="rounded-[8px] bg-[#e8f4ff] px-3 py-2 text-[12px] text-[#0a5fc4]">This picture already has a transparent background, so it is kept as it is and only trimmed.</p>}

            {!analysis.alreadyTransparent && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[12px] text-[color:var(--ink-soft)]">
                  <span className="flex justify-between"><span>Remove more</span><span>Keep more</span></span>
                  <input type="range" min={0} max={100} value={sensitivity} onChange={(e) => setSensitivity(Number(e.target.value))} className="w-full accent-[color:var(--brand)]" aria-label="Background removal strength" />
                  <span>Slide towards “Remove more” if grey paper or specks remain, towards “Keep more” if the thin strokes look broken.</span>
                </label>
                {!isStamp && (
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--ink-soft)]">
                    <span>Ink colour</span>
                    <button type="button" className={chip(ink === "original")} onClick={() => setInk("original")}>As written</button>
                    <button type="button" className={chip(ink === "black")} onClick={() => setInk("black")}>Black</button>
                    <button type="button" className={chip(ink === "blue")} onClick={() => setInk("blue")}>Blue</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error}</p>}
      </div>
    </Modal>
  );
}
