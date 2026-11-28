"use client";

/**
 * Builds the prescription letterhead from a logo and lines of text (no photo needed): the doctor's name and qualifications on the left, the
 * logo and hospital name on the right, a footer of address and timings, and an optional faint logo in the middle. Half-size prescriptions
 * draw it as real text, so it stays sharp when printed.
 */
import { useRef, useState } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useMutation } from "@/lib/api/hooks";
import { EMPTY_DESIGN, LetterheadFooter, LetterheadHeader, LetterheadWatermark, parseDesign, type LetterheadDesign } from "@/components/shared/LetterheadDesign";

/** The logo, shrunk to at most 400 px on its longest side and kept as PNG so a transparent background survives. */
async function toLogo(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error("That file could not be read as a picture. Use a PNG or JPG.")); i.src = url; });
    const k = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const g = c.getContext("2d");
    if (!g) throw new Error("This browser cannot prepare the picture.");
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

const lines = (t: string) => t.split(/\r?\n/);

export function LetterheadDesigner({ saved, canEdit, hospitalName, onChanged }: { saved: string | null; canEdit: boolean; hospitalName: string; onChanged: () => void }) {
  const start = parseDesign(saved);
  const [d, setD] = useState<LetterheadDesign>(start.name || start.logo || start.leftLines.length || start.footerLines.length ? start : { ...EMPTY_DESIGN, name: hospitalName });
  const [left, setLeft] = useState(start.leftLines.join("\n"));
  const [foot, setFoot] = useState(start.footerLines.join("\n"));
  const { run, loading, error } = useMutation();
  const pick = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState("");
  const [bad, setBad] = useState("");
  const set = (patch: Partial<LetterheadDesign>) => { setMsg(""); setD((x) => ({ ...x, ...patch })); };

  const current: LetterheadDesign = { ...d, leftLines: lines(left), footerLines: lines(foot) };
  async function save(enabled: boolean) {
    setMsg(""); setBad("");
    const out: LetterheadDesign = { ...current, enabled, leftLines: current.leftLines.map((l) => l.trim()).filter(Boolean), footerLines: current.footerLines.map((l) => l.trim()).filter(Boolean) };
    try {
      await run(() => api.put("/admin/settings", { letterheadDesign: JSON.stringify(out) }));
      setD({ ...d, enabled });
      setMsg(enabled ? "Saved. Half-size prescriptions now use this letterhead." : "Saved, and switched off. Prescriptions use the picture or the standard header.");
      onChanged();
    } catch (e) { setBad((e as Error).message || "That could not be saved."); }
  }

  const field = "w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-3 py-2 text-[13px] focus:border-[color:var(--brand)] focus:outline-none disabled:opacity-60";
  const label = "flex flex-col gap-1 text-[12px] text-[color:var(--ink-soft)]";
  const SCALE = 0.5, W = 794, H = 1123;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[16px] font-medium text-[color:var(--ink)]">Build a letterhead from your logo and text</h3>
        <span className={`rounded-full px-3 py-[3px] text-[12px] ${d.enabled ? "bg-[#dffff3] text-[#00955c]" : "bg-[color:var(--subtle-2)] text-[color:var(--ink-soft)]"}`}>{d.enabled ? "In use" : "Not in use"}</span>
      </div>
      <p className="max-w-[620px] text-[13px] text-[color:var(--ink-soft)]">
        Type the doctor, hospital and footer details once and upload the logo. It is printed as sharp text on half-size prescriptions, and it is used
        instead of the picture below while it is switched on.
      </p>
      <div className="flex flex-wrap items-start gap-6">
        <div className="flex min-w-[300px] flex-1 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {d.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={d.logo} alt="Logo" className="h-[48px] w-auto rounded border border-[color:var(--line)] bg-white p-1" />}
            {canEdit && (
              <>
                <input ref={pick} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; try { set({ logo: await toLogo(f) }); setBad(""); } catch (x) { setBad((x as Error).message); } }} />
                <button type="button" onClick={() => pick.current?.click()} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] hover:bg-[color:var(--subtle)]"><ImageUp size={14} /> {d.logo ? "Replace logo" : "Upload logo"}</button>
                {d.logo && <button type="button" onClick={() => set({ logo: "" })} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[color:var(--line)] px-4 py-[7px] text-[13px] text-[#b3001b] hover:bg-[color:var(--subtle)]"><Trash2 size={14} /> Remove</button>}
              </>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>Hospital name<input className={field} disabled={!canEdit} value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Patel Hospital" /></label>
            <label className={label}>Line under the name<input className={field} disabled={!canEdit} value={d.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="ICU & Diabetes Clinic" /></label>
          </div>
          <label className={label}>
            Left of the header: doctor&apos;s qualifications, one line each
            <textarea className={field} rows={4} disabled={!canEdit} value={left} onChange={(e) => { setMsg(""); setLeft(e.target.value); }} placeholder={"M.B.B.S., DNB (Medicine)\nConsultant Physician, Cardiologist & Diabetologist\nPost Graduate Diploma in Diabetes & Endocrinology"} />
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[color:var(--ink)]"><input type="checkbox" disabled={!canEdit} checked={d.useDoctorName} onChange={(e) => set({ useDoctorName: e.target.checked })} /> Start with the prescribing doctor&apos;s name (otherwise the first line above is bold)</label>
          <label className={label}>
            Footer, one line each. Put a colon between the label and the text to colour the label (OPD Timings : Monday to Saturday)
            <textarea className={field} rows={4} disabled={!canEdit} value={foot} onChange={(e) => { setMsg(""); setFoot(e.target.value); }} placeholder={"HOSPITAL : Ground Floor, Ambica Shopping Center, Gotri, Vadodara - 390021\nOPD Timings : Monday to Saturday 10-00 am to 1-00 pm and 5-00 pm to 8-00 pm\nFor Appointment : 0265 - 2371446 | IN-CASE OF EMERGENCY CALL : 91739 15697"} />
          </label>
          <div className="flex flex-wrap items-center gap-5 text-[13px] text-[color:var(--ink)]">
            <label className="flex items-center gap-2">Colour <input type="color" disabled={!canEdit} value={d.accent} onChange={(e) => set({ accent: e.target.value })} className="h-[30px] w-[44px] cursor-pointer rounded border border-[color:var(--line)] bg-transparent" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={d.watermark} onChange={(e) => set({ watermark: e.target.checked })} /> Faint logo in the middle of the page</label>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={loading} onClick={() => void save(true)} className="h-[36px] cursor-pointer rounded-full bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50">{loading ? "Saving…" : d.enabled ? "Save changes" : "Save and use this letterhead"}</button>
              {d.enabled && <button type="button" disabled={loading} onClick={() => void save(false)} className="h-[36px] cursor-pointer rounded-full border border-[color:var(--line)] px-5 text-[13px] hover:bg-[color:var(--subtle)]">Switch off</button>}
            </div>
          )}
          {(bad || error) && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{bad || error?.message}</p>}
          {msg && !error && !bad && <p className="text-[13px] text-[#00955c]">{msg}</p>}
        </div>
        <div className="shrink-0">
          <p className="mb-1 text-[12px] text-[color:var(--ink-soft)]">Preview</p>
          <div className="relative overflow-hidden rounded-[6px] border border-[color:var(--line)] bg-white shadow" style={{ width: W * SCALE, height: H * SCALE }}>
            <div className="relative flex flex-col" style={{ width: W, height: H, transform: `scale(${SCALE})`, transformOrigin: "top left", fontFamily: "Arial, Helvetica, sans-serif" }}>
              <LetterheadWatermark design={current} />
              <LetterheadHeader design={current} doctorName="Dr. Shishir Patel" />
              <div className="flex-1 px-7 pt-6 text-[11px] text-[#999]">Prescription is written here</div>
              <LetterheadFooter design={current} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
