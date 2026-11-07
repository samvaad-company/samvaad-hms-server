"use client";

/**
 * A pre-authorisation form as the insurer prints it: its own letterhead lines and heading, the standard Part C details in its order and
 * wording, its declaration, and the signature, stamp and seal blocks. The same layout is used to fill the form in (inputs) and to show
 * and print it (values), so what is filled in is what comes out.
 */
import { useMemo } from "react";
import { PREAUTH_FIELDS, PREAUTH_SECTIONS, TREATMENT_OPTIONS, type PreauthFormDef, type PreauthValues } from "@/types/preauth";
import { formatDate } from "@/lib/dates";

const STANDARD_DECLARATION = [
  "I agree to allow the hospital to submit all original documents pertaining to hospitalisation to the Insurer / TPA after the discharge. I agree to sign on the final bill and the discharge summary before my discharge.",
  "Payment to the hospital is governed by the terms and conditions of the policy. In case the Insurer / TPA is not liable to settle the hospital bill, I undertake to settle the bill as per the terms and conditions of the policy.",
  "All non-medical expenses, expenses not relevant to the current hospitalisation and amounts over and above the limit authorised by the Insurer / TPA will be paid by me.",
  "I hereby declare to abide by the terms and conditions of the policy, and if at any time the facts disclosed by me are found to be false or incorrect I forfeit my claim and agree to indemnify the Insurer / TPA.",
  "I authorise the Insurer / TPA to contact me through mobile or email for any update on this claim.",
];

const line = "border-b border-dotted border-[color:var(--ink-soft)]";
const inputCls = "w-full min-w-0 rounded-[6px] border border-[color:var(--line)] bg-[color:var(--surface)] px-2 py-[5px] text-[13px] text-[color:var(--ink)] outline-none focus:border-[color:var(--brand)]";

interface Props {
  def: PreauthFormDef;
  values: PreauthValues;
  onChange?: (key: string, value: string) => void;
  /** Fill-in mode (inputs) instead of the finished form. */
  editable?: boolean;
  /** Which sections can still be changed, when editing the form after it has been sent to the doctor. */
  doctorSignatureImg?: string | null;
  doctorStampImg?: string | null;
  hospitalStampImg?: string | null;
  doctorSignedAt?: string | null;
  /** Let the doctor fill their qualification and registration number while signing. */
  declarationEditable?: boolean;
}

export function PreauthDocument({ def, values, onChange, editable, doctorSignatureImg, doctorStampImg, hospitalStampImg, doctorSignedAt, declarationEditable }: Props) {
  const set = (k: string, v: string) => onChange?.(k, v);
  const sections = useMemo(() => PREAUTH_SECTIONS.map((s) => ({ ...s, fields: def.fields.filter((f) => PREAUTH_FIELDS[f.key]?.section === s.key) })).filter((s) => s.fields.length), [def]);
  const letters = "abcdefghijklmnopqrstuvwxyz";
  const paragraphs = def.declaration.length ? def.declaration : STANDARD_DECLARATION;

  return (
    <div className="bg-white text-[#1b1b22] text-[13px] leading-[19px]" style={{ colorScheme: "light" }}>
      {/* Letterhead */}
      <div className="border-b-2 border-[#1b1b22] px-6 pt-5 pb-3 text-center">
        {def.header.map((h, i) => <p key={i} className={i === 0 ? "text-[16px] font-bold tracking-wide" : "text-[11px] text-[#444]"}>{h}</p>)}
        <p className="mt-2 text-[14px] font-bold uppercase">{def.title}</p>
        <p className="text-[11px] uppercase text-[#444]">To be filled in block letters{def.kind === "TPA" ? " · TPA form" : ""}</p>
      </div>

      <div className="flex flex-col gap-5 px-6 py-4">
        {sections.map((s) => (
          <section key={s.key}>
            <h3 className="mb-2 border-b border-[#1b1b22] pb-[2px] text-[12px] font-bold uppercase tracking-wide">{s.title}</h3>
            <div className="grid grid-cols-1 gap-x-6 gap-y-[10px] sm:grid-cols-2">
              {s.fields.map((f, i) => {
                const spec = PREAUTH_FIELDS[f.key];
                const label = f.label || spec.label;
                const wide = spec.wide || spec.type === "treatment" || spec.type === "maternity";
                return (
                  <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
                    <div className="mb-[2px] text-[11px] font-semibold text-[#333]">{letters[i % 26]}) {label}</div>
                    <Value type={spec.type} k={f.key} value={values[f.key] ?? ""} editable={!!editable} set={set} />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* Declaration */}
        <section>
          <h3 className="mb-2 border-b border-[#1b1b22] pb-[2px] text-[12px] font-bold uppercase tracking-wide">Declaration (please read very carefully)</h3>
          <div className="flex flex-col gap-1 text-[11.5px] leading-[16px] text-[#222]">
            {paragraphs.map((p, i) => /^[A-Z][A-Z0-9 \/&',\-()]{7,}$/.test(p.split("(")[0].trim()) && p.split(" ").length < 14
              ? <p key={i} className="mt-1 font-bold uppercase">{p}</p>
              : <p key={i}>{p}</p>)}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Labelled label="Patient's / insured's name"><Value type="text" k="declPatientName" value={values.declPatientName ?? ""} editable={!!editable} set={set} /></Labelled>
            <Labelled label="Contact number"><Value type="text" k="declPatientContact" value={values.declPatientContact ?? ""} editable={!!editable} set={set} /></Labelled>
            <Labelled label="Email ID (optional)"><Value type="text" k="declPatientEmail" value={values.declPatientEmail ?? ""} editable={!!editable} set={set} /></Labelled>
            <Labelled label="Patient's / insured's signature"><div className={`h-9 ${line}`} /></Labelled>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            <Labelled label="Name of the treating doctor"><Value type="text" k="doctorName" value={values.doctorName ?? ""} editable={false} set={set} /></Labelled>
            <Labelled label="Qualification"><Value type="text" k="declQualification" value={values.declQualification ?? ""} editable={!!editable || !!declarationEditable} set={set} /></Labelled>
            <Labelled label="Registration no. with state code"><Value type="text" k="declRegNo" value={values.declRegNo ?? ""} editable={!!editable || !!declarationEditable} set={set} /></Labelled>
            <Labelled label="Date"><div className={`min-h-[26px] ${line}`}>{doctorSignedAt ? formatDate(doctorSignedAt.slice(0, 10)) : ""}</div></Labelled>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Block label="Doctor's signature and stamp">
              {doctorSignatureImg || doctorStampImg ? (
                <div className="flex items-center gap-4">
                  {doctorSignatureImg && <img src={doctorSignatureImg} alt="Doctor's signature" className="max-h-[70px] max-w-[160px] object-contain" />}
                  {doctorStampImg && <img src={doctorStampImg} alt="Doctor's stamp" className="max-h-[80px] max-w-[110px] object-contain" />}
                </div>
              ) : <Pending text={editable ? "Signed by the treating doctor once the form is sent" : "Awaiting the doctor's signature"} />}
            </Block>
            <Block label="Hospital seal">
              {hospitalStampImg ? <img src={hospitalStampImg} alt="Hospital stamp" className="max-h-[90px] max-w-[140px] object-contain" /> : <Pending text={editable ? "Stamped by the hospital's admin after the doctor signs" : "Awaiting the hospital stamp"} />}
            </Block>
          </div>
        </section>

        {def.footer.length > 0 && (
          <footer className="border-t border-[#999] pt-2 text-center text-[10px] text-[#555]">
            {def.footer.map((f, i) => <p key={i}>{f}</p>)}
          </footer>
        )}
        {def.scanned && <p className="text-center text-[10px] text-[#777]">This insurer publishes its form as a scanned page; it is set out here in the standard Part C layout under the insurer&apos;s name.</p>}
      </div>
    </div>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-[2px] text-[11px] font-semibold text-[#333]">{label}</div>{children}</div>;
}
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-1 text-[11px] font-semibold text-[#333]">{label}</div><div className="flex min-h-[90px] items-end border border-dashed border-[#999] p-2">{children}</div></div>;
}
function Pending({ text }: { text: string }) {
  return <span className="text-[11px] italic text-[#888]" data-pending>{text}</span>;
}

function Value({ type, k, value, editable, set }: { type: string; k: string; value: string; editable: boolean; set: (k: string, v: string) => void }) {
  const choice = (opts: string[]) => (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {opts.map((o) => editable ? (
        <label key={o} className="inline-flex cursor-pointer items-center gap-1"><input type="radio" name={k} checked={value === o} onChange={() => set(k, o)} /> {o}</label>
      ) : (
        <span key={o} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 border border-[#1b1b22] text-center text-[10px] leading-[10px] ${value === o ? "bg-[#1b1b22] text-white" : ""}`}>{value === o ? "✓" : ""}</span> {o}</span>
      ))}
      {editable && value && <button type="button" onClick={() => set(k, "")} className="text-[11px] text-[#777] underline cursor-pointer">clear</button>}
    </div>
  );

  if (type === "gender") return choice(["Male", "Female", "Third gender"]);
  if (type === "yesno") return choice(["Yes", "No"]);
  if (type === "emergency") return choice(["Emergency", "Planned"]);
  if (type === "treatment") {
    const picked = new Set(value.split("|").filter(Boolean));
    const toggle = (o: string) => { const n = new Set(picked); if (n.has(o)) n.delete(o); else n.add(o); set(k, [...n].join("|")); };
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {TREATMENT_OPTIONS.map((o) => editable ? (
          <label key={o} className="inline-flex cursor-pointer items-center gap-1"><input type="checkbox" checked={picked.has(o)} onChange={() => toggle(o)} /> {o}</label>
        ) : (
          <span key={o} className="inline-flex items-center gap-1"><span className={`inline-block h-3 w-3 border border-[#1b1b22] text-center text-[10px] leading-[10px] ${picked.has(o) ? "bg-[#1b1b22] text-white" : ""}`}>{picked.has(o) ? "✓" : ""}</span> {o}</span>
        ))}
      </div>
    );
  }
  if (type === "maternity") {
    const parts = (value || "|||").split("|");
    const upd = (i: number, v: string) => { const n = [...parts, "", "", "", ""].slice(0, 4); n[i] = v.slice(0, 2); set(k, n.join("|")); };
    return (
      <div className="flex flex-wrap items-center gap-3">
        {["G", "P", "L", "A"].map((l, i) => (
          <span key={l} className="inline-flex items-center gap-1">{l}{editable ? <input className={`${inputCls} !w-12 text-center`} value={parts[i] ?? ""} onChange={(e) => upd(i, e.target.value)} /> : <span className={`inline-block min-w-8 text-center ${line}`}>{parts[i] ?? ""}</span>}</span>
        ))}
      </div>
    );
  }
  if (type === "chronic") {
    return editable
      ? <input className={inputCls} placeholder="MM/YY, or leave blank" value={value} onChange={(e) => set(k, e.target.value)} />
      : <div className={`min-h-[22px] ${line}`}>{value || ""}</div>;
  }
  if (type === "longtext") {
    return editable
      ? <textarea className={`${inputCls} min-h-[52px] resize-y`} value={value} onChange={(e) => set(k, e.target.value)} />
      : <div className={`min-h-[22px] whitespace-pre-wrap ${line}`}>{value}</div>;
  }
  if (editable) {
    const t = type === "date" ? "date" : type === "time" ? "time" : type === "number" || type === "money" ? "number" : "text";
    return <input type={t} min={t === "number" ? 0 : undefined} className={inputCls} value={value} onChange={(e) => set(k, e.target.value)} />;
  }
  const shown = type === "date" && value ? formatDate(value) : type === "money" && value ? `Rs. ${Number(value).toLocaleString("en-IN")}` : value;
  return <div className={`min-h-[22px] ${line}`}>{shown}</div>;
}

