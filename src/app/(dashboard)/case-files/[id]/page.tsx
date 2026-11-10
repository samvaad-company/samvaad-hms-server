"use client";

/**
 * One admission's case file. The forms are listed in the order they are kept; each is the sheet itself, filled in on screen, saved
 * for everyone, and printed or downloaded as a PDF (the whole file, or one form). What other parts of the app already know about the
 * patient (vitals, rounds, medicines, IV, handovers) is shown in the matching form.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowUp, Download, GripVertical, Printer, RotateCcw, Save } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useItem } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import { PatientName } from "@/components/loyalty/PatientName";
import { FormEditor, fmtDate, hasContent, unitData, unitsOf, withUnit, type Unit } from "@/components/casefile/FormEngine";
import { FORMS, type FormDef } from "@/lib/casefile/forms";
import { CASEFILE_CSS } from "@/lib/casefile/css";
import { buildCaseFilePdf, downloadBlob, pdfName, printCaseFile } from "@/lib/casefile/pdf";
import type { CaseFileDTO, CaseFormRecordDTO } from "@/types/casefile";

const PAPER = 794;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function CaseFilePage() {
  const { id } = useParams<{ id: string }>();
  const { can, user } = useAuth();
  const { item: file, loading, error, reload } = useItem<CaseFileDTO>(`/casefile/${id}`);
  useBreadcrumb("/case-files", "Case files", file ? file.patient.name : "Case file");

  const [keyChoice, setKey] = useState<string>("");
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [saved, setSaved] = useState<Record<string, CaseFormRecordDTO>>({});
  const [units, setUnits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<"" | "save" | "pdf" | "print">("");
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error" | "conflict"; text: string } | null>(null);

  // The forms in the order this hospital keeps them (its admin can rearrange them).
  const ordered = useMemo(() => (file ? file.order : FORMS.map((f) => f.key)).map((k) => FORMS.find((f) => f.key === k)).filter((f): f is FormDef => !!f), [file]);
  const key = keyChoice || ordered[0].key;
  const def = FORMS.find((f) => f.key === key) as FormDef;
  const isAdmin = user?.role === "Super Admin";
  const [arranging, setArranging] = useState<string[] | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const move = (from: number, to: number) => setArranging((o) => { if (!o || to < 0 || to >= o.length) return o; const n = [...o]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; });
  const saveOrder = async (body: { order: string[] } | { reset: true }) => {
    setBusy("save"); setMessage(null);
    try { await api.put("/casefile-order", body); setArranging(null); reload(); setMessage({ kind: "ok", text: "reset" in body ? "The forms are back in the standard order for everyone." : "Saved. Your staff now see the forms in this order." }); }
    catch (e) { setMessage({ kind: "error", text: (e as { message?: string }).message ?? "Couldn't save the order." }); }
    finally { setBusy(""); }
  };
  const rec: CaseFormRecordDTO = saved[key] ?? file?.forms[key] ?? { data: {}, version: 0, updatedAt: null, updatedBy: "" };
  const data = drafts[key] ?? rec.data;
  const dirty = key in drafts;
  const dirtyKeys = Object.keys(drafts);
  const canEdit = rec.version === 0 ? can("casefile", "add") : can("casefile", "edit");

  // The file as it would print right now, including anything not saved yet.
  const current = useMemo<CaseFileDTO | null>(() => {
    if (!file) return null;
    const forms = { ...file.forms };
    for (const k of Object.keys(forms)) forms[k] = { ...(saved[k] ?? forms[k]), data: drafts[k] ?? (saved[k] ?? forms[k]).data };
    return { ...file, forms };
  }, [file, saved, drafts]);

  const unit = useMemo(() => {
    if (def.scope === "single") return "_";
    if (units[key]) return units[key];
    if (def.scope === "sheet") return "0";
    const days = unitsOf(def, data, current);
    return days.includes(today()) ? today() : days[days.length - 1] ?? today();
  }, [def, units, key, data, current]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirtyKeys.length) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirtyKeys.length]);

  const change = (next: Unit) => { setMessage(null); setDrafts((d) => ({ ...d, [key]: withUnit(def, d[key] ?? rec.data, unit, next) })); };

  const save = useCallback(async () => {
    if (!dirty || !canEdit) return;
    setBusy("save"); setMessage(null);
    try {
      const body = { data: drafts[key] };
      const out = rec.version === 0
        ? await api.post<CaseFormRecordDTO>(`/casefile/${id}/${key}`, body)
        : await api.put<CaseFormRecordDTO>(`/casefile/${id}/${key}`, { ...body, version: rec.version });
      setSaved((s) => ({ ...s, [key]: out }));
      setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });
      setMessage({ kind: "ok", text: "Saved." });
    } catch (e) {
      const err = e as { message?: string; status?: number };
      setMessage({ kind: err.status === 409 ? "conflict" : "error", text: err.message ?? "Couldn't save." });
    } finally { setBusy(""); }
  }, [dirty, canEdit, drafts, key, rec.version, id]);

  // Ctrl/Cmd + S saves the form.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  const discardAndReload = () => { setDrafts((d) => { const n = { ...d }; delete n[key]; return n; }); setSaved((s) => { const n = { ...s }; delete n[key]; return n; }); setMessage(null); reload(); };

  const run = async (kind: "pdf" | "print", keys?: string[]) => {
    if (!current) return;
    setBusy(kind); setMessage(null); setProgress("");
    try {
      if (kind === "print") await printCaseFile(current, keys);
      else {
        const blob = await buildCaseFilePdf(current, keys, (d, t) => setProgress(`Page ${d} of ${t}`));
        downloadBlob(blob, pdfName(current, keys?.length === 1 ? def.title : "Case file"));
      }
    } catch (e) { setMessage({ kind: "error", text: e instanceof Error ? e.message : "Couldn't prepare the PDF." }); }
    finally { setBusy(""); setProgress(""); }
  };

  // Fit the A4 sheet to the space on a narrow screen.
  const holder = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const el = holder.current; if (!el) return;
    const fit = () => setZoom(Math.min(1, (el.clientWidth - 2) / PAPER));
    fit();
    const ro = new ResizeObserver(fit); ro.observe(el);
    return () => ro.disconnect();
  }, [file]);

  if (error) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>{error.message}</p>;
  if (loading || !file || !current) return <p className={`${tw.gutterX} py-16 text-center text-[14px] text-[color:var(--ink-soft)]`}>Loading the case file…</p>;

  const btn = "inline-flex h-[34px] items-center gap-2 rounded-full px-4 text-[13px] cursor-pointer disabled:cursor-default disabled:opacity-50";
  const ghost = `${btn} border border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]`;
  const primary = `${btn} bg-[color:var(--brand)] text-white hover:bg-[color:var(--brand-hover)]`;
  const days = def.scope === "date" ? unitsOf(def, data, current) : [];
  const sheets = def.scope === "sheet" ? unitsOf(def, data, current) : [];
  const filled = (f: FormDef) => hasContent((drafts[f.key] ?? (saved[f.key] ?? file.forms[f.key]).data));
  const U = unitData(def, data, unit);

  return (
    <div className={`${tw.gutterX} mb-[30px] flex flex-col gap-4 pt-5`}>
      <style>{CASEFILE_CSS}</style>

      <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-3 p-4`}>
        <Link href="/case-files" aria-label="Back to case files" className="text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"><ArrowLeft size={18} /></Link>
        <div className="min-w-[200px] flex-1">
          <p className="text-[16px] font-medium text-[color:var(--ink)]"><PatientName id={file.patient.id} name={file.patient.name} /></p>
          <p className="text-[12px] text-[color:var(--ink-soft)]">{[file.patient.uhid, file.admission.ipdNo, [file.admission.ward, file.admission.bed].filter(Boolean).join(" · "), file.admission.doctor, `Admitted ${formatDate(file.admission.admittedOn)}`, file.admission.status].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={ghost} disabled={!!busy} onClick={() => run("print")}><Printer size={14} /> Print all</button>
          <button className={primary} disabled={!!busy} onClick={() => run("pdf")}><Download size={14} /> {busy === "pdf" ? progress || "Preparing…" : "Download full PDF"}</button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Forms in this file" className={`${tw.surface.card} ${tw.radius.card} flex flex-col gap-1 p-2`}>
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-1 px-1 pb-1">
              {arranging ? (
                <>
                  <button className={`${ghost} !h-[30px] !px-3`} disabled={busy === "save"} onClick={() => saveOrder({ order: arranging })}><Save size={13} /> Save order</button>
                  <button className={`${ghost} !h-[30px] !px-3`} onClick={() => setArranging(null)}>Cancel</button>
                  <button className={`${ghost} !h-[30px] !px-3`} disabled={busy === "save"} onClick={() => confirm("Put the forms back in the standard order for all your staff?") && saveOrder({ reset: true })}><RotateCcw size={13} /> Standard</button>
                  <p className="w-full text-[11.5px] text-[color:var(--ink-soft)]">Drag a form, or use the arrows, then Save order. This changes the order for all your staff.</p>
                </>
              ) : <button className={`${ghost} !h-[30px] !px-3`} onClick={() => setArranging(ordered.map((f) => f.key))}><GripVertical size={13} /> Arrange forms</button>}
            </div>
          )}
          <div className="flex flex-row gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {(arranging ? arranging.map((k) => FORMS.find((f) => f.key === k) as FormDef) : ordered).map((f, i) => (
              <div key={f.key} draggable={!!arranging}
                onDragStart={() => setDragKey(f.key)} onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => { if (arranging && dragKey) e.preventDefault(); }}
                onDrop={(e) => { e.preventDefault(); if (arranging && dragKey) move(arranging.indexOf(dragKey), i); setDragKey(null); }}
                className={`flex shrink-0 items-center rounded-[8px] ${dragKey === f.key ? "opacity-40" : ""} ${arranging ? "border border-dashed border-[color:var(--line)] bg-[color:var(--subtle)]" : ""}`}>
                {arranging && <GripVertical size={14} className="ml-1 shrink-0 cursor-grab text-[color:var(--ink-soft)]" aria-hidden />}
                <button onClick={() => { if (!arranging) { setKey(f.key); setMessage(null); } }} aria-current={f.key === key ? "page" : undefined}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-[8px] px-3 py-[8px] text-left text-[13px] ${arranging ? "cursor-grab" : "cursor-pointer"} ${f.key === key && !arranging ? "bg-[color:var(--brand-soft)] text-[color:var(--brand)]" : "text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"}`}>
                  <span className="w-[18px] shrink-0 text-[12px] text-[color:var(--ink-soft)]">{i + 1}</span>
                  <span className="whitespace-nowrap lg:whitespace-normal">{f.title}</span>
                  {!arranging && (f.key in drafts ? <span className="ml-auto h-[8px] w-[8px] shrink-0 rounded-full bg-[#e08a00]" title="Unsaved changes" /> : filled(f) ? <span className="ml-auto h-[8px] w-[8px] shrink-0 rounded-full bg-[#1a9b62]" title="Has entries" /> : null)}
                </button>
                {arranging && (
                  <span className="flex shrink-0 pr-1">
                    <button type="button" aria-label={`Move ${f.title} up`} disabled={i === 0} className="cursor-pointer p-1 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-30" onClick={() => move(i, i - 1)}><ArrowUp size={14} /></button>
                    <button type="button" aria-label={`Move ${f.title} down`} disabled={i === arranging.length - 1} className="cursor-pointer p-1 text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] disabled:opacity-30" onClick={() => move(i, i + 1)}><ArrowDown size={14} /></button>
                  </span>
                )}
              </div>
            ))}
          </div>
        </nav>

        <div className="flex min-w-0 flex-col gap-3">
          <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-3 p-3`}>
            <div className="min-w-[180px] flex-1">
              <p className="text-[15px] font-medium text-[color:var(--ink)]">{def.title}</p>
              <p className="text-[12px] text-[color:var(--ink-soft)]">{rec.version ? `Last saved by ${rec.updatedBy}${rec.updatedAt ? ` · ${formatDate(rec.updatedAt.slice(0, 10))} ${new Date(rec.updatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}` : "Not saved yet"}</p>
            </div>
            <button className={ghost} disabled={!!busy} onClick={() => run("pdf", [key])}><Download size={14} /> This form</button>
            <button className={ghost} disabled={!!busy} onClick={() => run("print", [key])}><Printer size={14} /> Print</button>
            {canEdit && <button className={primary} disabled={!dirty || busy === "save"} onClick={save}><Save size={14} /> {busy === "save" ? "Saving…" : "Save"}</button>}
          </div>

          {!canEdit && <p className="rounded-[8px] bg-[#fff6dd] px-3 py-2 text-[13px] text-[#7a4a00]">You can look at this form but your role can&apos;t change it. Ask the hospital&apos;s admin for access.</p>}
          {message && (
            <p role="status" className={`rounded-[8px] px-3 py-2 text-[13px] ${message.kind === "ok" ? "bg-[#dffff3] text-[#0b7a47]" : "bg-[#ffe9e9] text-[#c8001a]"}`}>
              {message.text}{message.kind === "conflict" && <> <button onClick={discardAndReload} className="ml-2 font-medium underline cursor-pointer">Reload this form</button> (what you typed here will be discarded).</>}
            </p>
          )}
          {def.linkedNote && <p className="rounded-[8px] bg-[#e8f4ff] px-3 py-2 text-[12.5px] text-[#0a5fc4]">{def.linkedNote}{def.scope !== "single" || def.key === "tpr_chart" ? "" : ""} Rows tinted blue come from there and are changed there.</p>}

          {def.scope === "date" && (
            <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-2 p-3 text-[13px]`}>
              <span className="text-[color:var(--ink-soft)]">Day</span>
              <input type="date" aria-label="Day" value={unit} onChange={(e) => e.target.value && setUnits((u) => ({ ...u, [key]: e.target.value }))} className="h-[34px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--subtle)] px-2" />
              <button className={ghost} onClick={() => setUnits((u) => ({ ...u, [key]: today() }))}>Today</button>
              {days.filter((d) => d !== unit).slice(-8).map((d) => <button key={d} className={ghost} onClick={() => setUnits((u) => ({ ...u, [key]: d }))}>{fmtDate(d).slice(0, 5)}</button>)}
            </div>
          )}
          {def.scope === "sheet" && (
            <div className={`${tw.surface.card} ${tw.radius.card} flex flex-wrap items-center gap-2 p-3 text-[13px]`}>
              {sheets.map((s) => <button key={s} className={Number(s) === Number(unit) ? primary : ghost} onClick={() => setUnits((u) => ({ ...u, [key]: s }))}>Sheet {Number(s) + 1}</button>)}
              {canEdit && <button className={ghost} onClick={() => { const n = String(sheets.length); change({}); setUnits((u) => ({ ...u, [key]: n })); setDrafts((d) => ({ ...d, [key]: withUnit(def, d[key] ?? rec.data, n, {}) })); }}>+ Add sheet</button>}
            </div>
          )}

          <div ref={holder} className="overflow-x-auto rounded-[10px] bg-[#e3e7ee] p-2 sm:p-4">
            <fieldset disabled={!canEdit || busy === "save"} className="m-0 min-w-0 border-0 p-0" style={{ zoom }}>
              <FormEditor key={`${key}-${unit}`} def={def} unit={unit} U={U} file={current} onChange={change} />
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}
