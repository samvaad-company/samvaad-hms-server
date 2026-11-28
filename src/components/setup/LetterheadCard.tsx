"use client";

/**
 * The hospital's own letterhead for prescriptions. An admin uploads a picture of the printed letterhead (a full page, A4); half-size
 * prescriptions are then written inside it, kept clear of its header and footer by the two margins below.
 */
import { useRef, useState } from "react";
import { ImageUp, SlidersHorizontal, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { LetterheadEditor } from "./LetterheadEditor";
import { LetterheadDesigner } from "./LetterheadDesigner";

export function LetterheadCard({ url, topMm, bottomMm, design, hospitalName, canEdit, onChanged }: { url: string | null; topMm: number; bottomMm: number; design: string | null; hospitalName: string; canEdit: boolean; onChanged: () => void }) {
  const { run, loading, error } = useMutation();
  const pick = useRef<HTMLInputElement>(null);
  const [top, setTop] = useState(String(topMm));
  const [bottom, setBottom] = useState(String(bottomMm));
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState("");

  const [editing, setEditing] = useState<string | null>(null);

  /** Opens the editor on a newly picked file (to line it up with the page) before anything is saved. */
  function pickFile(file: File) {
    setMsg(""); setBad("");
    const r = new FileReader();
    r.onload = () => setEditing(String(r.result));
    r.onerror = () => setBad("That file could not be read. Use a PNG or JPG.");
    r.readAsDataURL(file);
  }
  async function saveEdited(data: string) {
    await run(() => api.put("/admin/settings", { letterheadUrl: data }));
    setEditing(null);
    setMsg("Letterhead saved. Half-size prescriptions are now printed on it.");
    onChanged();
  }
  async function saveMargins() {
    setMsg(""); setBad("");
    try {
      await run(() => api.put("/admin/settings", { letterheadTopMm: Number(top) || 0, letterheadBottomMm: Number(bottom) || 0 }));
      setMsg("Margins saved.");
      onChanged();
    } catch (e) { setBad((e as Error).message); }
  }
  async function remove() {
    setMsg(""); setBad("");
    try { await run(() => api.put("/admin/settings", { letterheadUrl: "" })); setMsg("Letterhead removed. Prescriptions use the standard header again."); onChanged(); }
    catch (e) { setBad((e as Error).message); }
  }

  const input = "h-[34px] w-[80px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-2 text-[13px] focus:border-[color:var(--brand)] focus:outline-none";
  return (
    <div className="flex flex-col gap-3">
      <LetterheadDesigner saved={design} canEdit={canEdit} hospitalName={hospitalName} onChanged={onChanged} />
      <hr className="my-3 border-[color:var(--line)]" />
      <h3 className="text-[16px] font-medium text-[color:var(--ink)]">Or use a picture of your letterhead</h3>
      <p className="max-w-[620px] text-[13px] text-[color:var(--ink-soft)]">
        Upload a picture of your printed letterhead (PNG or JPG; a phone photo is fine), then arrange and align it to the page. Half-size prescriptions are written inside it, so they can be printed
        or shared on your own letterhead. Full prescriptions keep the standard layout.
      </p>
      <div className="flex flex-wrap items-start gap-5">
        <div className="relative h-[210px] w-[148px] shrink-0 overflow-hidden rounded-[8px] border border-[color:var(--line)] bg-white">
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Letterhead" className="h-full w-full object-fill" />
              <div className="absolute inset-x-0 border-y border-dashed border-[#d9534f]/60 bg-[#d9534f]/5" style={{ top: `${Math.min(60, (Number(top) / 297) * 100)}%`, bottom: `${Math.min(40, (Number(bottom) / 297) * 100)}%` }} title="Where the prescription is written" />
            </>
          ) : <div className="flex h-full items-center justify-center px-3 text-center text-[12px] text-[color:var(--ink-soft)]">No letterhead yet</div>}
        </div>
        <div className="flex min-w-[240px] flex-1 flex-col gap-3">
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <input ref={pick} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) pickFile(f); }} />
              <button type="button" disabled={loading} onClick={() => pick.current?.click()} className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-[color:var(--brand)] px-4 py-[7px] text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50">
                <ImageUp size={14} /> {url ? "Replace letterhead" : "Upload letterhead"}
              </button>
              {url && <button type="button" disabled={loading} onClick={() => { setMsg(""); setBad(""); setEditing(url); }} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] hover:bg-[color:var(--subtle)]"><SlidersHorizontal size={14} /> Arrange &amp; align</button>}
              {url && <button type="button" disabled={loading} onClick={() => void remove()} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[#b3001b] hover:bg-[color:var(--subtle)]"><Trash2 size={14} /> Remove</button>}
            </div>
          )}
          {url && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-[12px] text-[color:var(--ink-soft)]">Top margin (mm)
                <input className={input} inputMode="numeric" value={top} disabled={!canEdit} onChange={(e) => setTop(e.target.value.replace(/[^0-9]/g, ""))} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-[color:var(--ink-soft)]">Bottom margin (mm)
                <input className={input} inputMode="numeric" value={bottom} disabled={!canEdit} onChange={(e) => setBottom(e.target.value.replace(/[^0-9]/g, ""))} />
              </label>
              {canEdit && <button type="button" disabled={loading} onClick={() => void saveMargins()} className="h-[34px] cursor-pointer rounded-[8px] border border-[color:var(--line)] px-4 text-[13px] hover:bg-[color:var(--subtle)]">Save margins</button>}
              <p className="basis-full text-[11px] text-[color:var(--ink-soft)]">The red band on the preview is where the prescription is written. Raise the margins to clear a tall printed header or footer.</p>
            </div>
          )}
          {!canEdit && <p className="text-[12px] text-[color:var(--ink-soft)]">Only an administrator can change the letterhead.</p>}
          {(bad || error) && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{bad || error?.message}</p>}
          {msg && !error && !bad && <p className="text-[13px] text-[#00955c]">{msg}</p>}
        </div>
      </div>
      {editing && <LetterheadEditor src={editing} topMm={Number(top) || 0} bottomMm={Number(bottom) || 0} onCancel={() => setEditing(null)} onDone={saveEdited} />}
    </div>
  );
}
