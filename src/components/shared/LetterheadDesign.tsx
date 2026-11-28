/**
 * A letterhead built from a logo and lines of text instead of a photographed sheet: the doctor on the left, the logo and hospital name on
 * the right, a footer of address and timings, and an optional faint logo in the middle of the page. Text stays sharp at any print size.
 * The settings page edits it and the half-size prescription draws it, both through these pieces.
 */
import type { CSSProperties } from "react";

export interface LetterheadDesign {
  enabled: boolean;
  /** A small picture (data URL) of the hospital's logo. */
  logo: string;
  /** Hospital name and the line under it (for example "ICU & Diabetes Clinic"). */
  name: string;
  tagline: string;
  /** Use the prescribing doctor's name as the first line on the left; the lines below follow it. */
  useDoctorName: boolean;
  /** Lines on the left of the header (doctor name and qualifications). The first is bold unless the doctor's own name leads. */
  leftLines: string[];
  /** Footer lines. Text before the first " : " is drawn in the accent colour ("OPD Timings : Mon to Sat"). */
  footerLines: string[];
  /** Colour of the footer rule and labels. */
  accent: string;
  /** A faint copy of the logo in the middle of the page. */
  watermark: boolean;
}

export const EMPTY_DESIGN: LetterheadDesign = { enabled: false, logo: "", name: "", tagline: "", useDoctorName: true, leftLines: [], footerLines: [], accent: "#c0392b", watermark: true };

/** Reads the saved text back into a design; anything unreadable gives the empty design. */
export function parseDesign(raw: string | null | undefined): LetterheadDesign {
  if (!raw) return EMPTY_DESIGN;
  try {
    const d = JSON.parse(raw) as Partial<LetterheadDesign>;
    const lines = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)) : []);
    return {
      enabled: !!d.enabled, logo: typeof d.logo === "string" ? d.logo : "", name: String(d.name ?? ""), tagline: String(d.tagline ?? ""),
      useDoctorName: d.useDoctorName !== false, leftLines: lines(d.leftLines), footerLines: lines(d.footerLines),
      accent: typeof d.accent === "string" && /^#[0-9a-f]{6}$/i.test(d.accent) ? d.accent : EMPTY_DESIGN.accent, watermark: d.watermark !== false,
    };
  } catch { return EMPTY_DESIGN; }
}

const nonEmpty = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean);

export function LetterheadHeader({ design, doctorName, doctorLine }: { design: LetterheadDesign; doctorName?: string; doctorLine?: string }) {
  const left = nonEmpty(design.leftLines);
  const lead = design.useDoctorName && doctorName ? doctorName : left.shift();
  const rest = design.useDoctorName && doctorName && doctorLine && !left.length ? [doctorLine] : left;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "16px 28px 10px" }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {lead && <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#222" }}>{lead}</p>}
        {rest.map((t, i) => <p key={i} style={{ margin: i === 0 ? "1px 0 0" : 0, fontSize: 9, lineHeight: 1.35, color: "#333" }}>{t}</p>)}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {design.logo && /* eslint-disable-next-line @next/next/no-img-element */ <img src={design.logo} alt="" style={{ height: 46, width: "auto", objectFit: "contain" }} />}
        {(design.name || design.tagline) && (
          <div>
            {design.name && <p style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.1, color: "#222", fontFamily: "Georgia, 'Times New Roman', serif", letterSpacing: 0.5 }}>{design.name.toUpperCase()}</p>}
            {design.tagline && <p style={{ margin: "2px 0 0", fontSize: 8.5, color: "#555", fontFamily: "Georgia, 'Times New Roman', serif" }}>{design.tagline}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function LetterheadFooter({ design }: { design: LetterheadDesign }) {
  const lines = nonEmpty(design.footerLines);
  if (!lines.length) return null;
  const label = { color: design.accent, fontWeight: 700 } as CSSProperties;
  return (
    <div style={{ margin: "0 20px", padding: "6px 0 8px", borderTop: `1.5px solid ${design.accent}`, textAlign: "center", fontSize: 9.5, lineHeight: 1.5, color: "#222" }}>
      {lines.map((l, i) => {
        const at = l.indexOf(" : ");
        return <p key={i} style={{ margin: 0 }}>{at > 0 ? <><span style={label}>{l.slice(0, at)}</span>{` : ${l.slice(at + 3)}`}</> : l}</p>;
      })}
    </div>
  );
}

export function LetterheadWatermark({ design }: { design: LetterheadDesign }) {
  if (!design.watermark || !design.logo) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={design.logo} alt="" style={{ position: "absolute", left: "50%", top: "50%", width: "42%", transform: "translate(-50%, -50%)", opacity: 0.09, pointerEvents: "none", objectFit: "contain" }} />;
}
