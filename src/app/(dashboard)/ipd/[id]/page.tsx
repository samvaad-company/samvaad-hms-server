"use client";

/**
 * An admitted patient's chart: who they are and what is owed at the top, then ten tabs — Summary, Treatment sheet, Rounds & notes,
 * Drug chart, IV & I/O, Nursing care, Consents & forms, TPA / insurance, Discharge and Timeline. The tab is kept in the address
 * (#sheet, #medicines …) so a link opens the right one.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Banknote, BedDouble, Printer, ShieldAlert } from "lucide-react";
import { tw } from "@/lib/design-system";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useBreadcrumb } from "@/lib/breadcrumb-context";
import type { BedDTO, IpdNoteDTO, IpdOverviewDTO, IpdRecordDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormRow, FormSelect } from "@/components/shared/FormRow";
import { PatientName } from "@/components/loyalty/PatientName";
import { AllergyDialog, PayerDialog, SummaryTab } from "@/components/ipd/patient/SummaryTab";
import { SheetTab } from "@/components/ipd/patient/SheetTab";
import { RoundsTab } from "@/components/ipd/patient/RoundsTab";
import { DrugChartTab } from "@/components/ipd/patient/DrugChartTab";
import { IvIoTab } from "@/components/ipd/patient/IvIoTab";
import { NursingTab } from "@/components/ipd/patient/NursingTab";
import { ConsentsTab, InsuranceTab } from "@/components/ipd/patient/PaperworkTabs";
import { DischargeTab } from "@/components/ipd/patient/DischargeTab";
import { TimelineTab } from "@/components/ipd/patient/TimelineTab";
import { ErrorLine, Pill, btn, done, inr, type ChartCtx } from "@/components/ipd/patient/ui";

const TABS = [
  { id: "summary", label: "Summary" },
  { id: "sheet", label: "Treatment sheet" },
  { id: "rounds", label: "Rounds & notes" },
  { id: "medicines", label: "Drug chart (MAR)" },
  { id: "io", label: "IV & I/O" },
  { id: "nursing", label: "Nursing care" },
  { id: "consents", label: "Consents & forms" },
  { id: "insurance", label: "TPA / insurance" },
  { id: "discharge", label: "Discharge" },
  { id: "timeline", label: "Timeline" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTab = (v: string): v is TabId => TABS.some((t) => t.id === v);

function DepositDialog({ ctx, open, onClose }: { ctx: ChartCtx; open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"Cash" | "UPI" | "Card">("Cash");
  const { run, loading, error, reset } = useMutation();
  async function save() {
    const add = Number(amount);
    if (!(add > 0)) return;
    if (!(await done(run(() => api.patch(`/ipd/${ctx.id}`, { depositAmount: ctx.record.depositAmount + add, depositMode: mode }))))) return;
    ctx.refresh();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Take a deposit" subtitle={`Deposit so far: ${inr(ctx.record.depositAmount)}`}
      footer={<><button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button onClick={save} disabled={loading || !(Number(amount) > 0)} className={`${btn.base} ${btn.solid}`}>{loading ? "Saving…" : "Take deposit"}</button></>}>
      <div className="flex flex-col gap-3">
        <FormRow label="Amount (₹)" required><FormInput type="number" value={amount} onChange={setAmount} placeholder="e.g. 10000" /></FormRow>
        <FormRow label="Paid by"><FormSelect value={mode} onChange={(v) => setMode(v as typeof mode)} options={["Cash", "UPI", "Card"].map((m) => ({ value: m, label: m }))} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

function ShiftBedDialog({ ctx, open, onClose }: { ctx: ChartCtx; open: boolean; onClose: () => void }) {
  const { items: beds } = useList<BedDTO>("/beds", { all: true });
  const free = beds.filter((b) => b.status === "Available");
  const [bedId, setBedId] = useState("");
  const { run, loading, error, reset } = useMutation();
  async function save() {
    if (!bedId) return;
    if (!(await done(run(() => api.post(`/ipd/${ctx.id}/transfer`, { bedId: Number(bedId) }))))) return;
    ctx.refresh();
    onClose();
  }
  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Shift bed" subtitle={`Now in ${ctx.record.ward} · ${ctx.record.bed || "no bed"}. The old bed goes to housekeeping.`}
      footer={<><button onClick={onClose} className={`${btn.base} ${btn.ghost}`}>Cancel</button><button onClick={save} disabled={loading || !bedId} className={`${btn.base} ${btn.solid}`}>{loading ? "Moving…" : "Shift bed"}</button></>}>
      <div className="flex flex-col gap-3">
        <FormRow label="New bed"><FormSelect value={bedId} onChange={setBedId} placeholder={free.length ? "Choose a free bed" : "No free beds"} options={free.map((b) => ({ value: String(b.id), label: `${b.bedNumber} · ${b.ward}${b.dailyRate ? ` · ${inr(b.dailyRate)}/day` : ""}` }))} /></FormRow>
        <ErrorLine error={error} />
      </div>
    </Modal>
  );
}

export default function IpdPatientPage() {
  const { id: raw } = useParams<{ id: string }>();
  const id = Number(raw);
  const { can, user } = useAuth();
  const [tab, setTab] = useState<TabId>("summary");
  const [dialog, setDialog] = useState<"" | "deposit" | "bed" | "allergy" | "payer">("");

  const { item: record, loading, reload } = useItem<IpdRecordDTO>(`/ipd/${id}`);
  const { item: overview, reload: reloadOverview } = useItem<IpdOverviewDTO>(`/ipd/${id}/overview`);
  const { items: notes, reload: reloadNotes } = useList<IpdNoteDTO>("/ipd/notes", { all: true, admission_id: id });
  useBreadcrumb("/ipd", "IPD", record?.patientName ?? "Admission");

  // The tab lives in the address so a link (and the back button) open the right one.
  useEffect(() => {
    const read = () => { const h = window.location.hash.replace("#", ""); if (isTab(h)) setTab(h); };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = useCallback((t: string) => {
    if (!isTab(t)) return;
    setTab(t);
    window.history.replaceState(null, "", `#${t}`);
  }, []);
  const refresh = useCallback(() => { reload(); reloadOverview(); reloadNotes(); }, [reload, reloadOverview, reloadNotes]);

  if (loading) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Loading…</p></div>;
  if (!record) return <div className={`${tw.gutterX} pt-10`}><p className="text-[14px] text-[color:var(--ink-soft)]">Admission not found.</p></div>;

  const discharged = record.status === "Discharged";
  const ctx: ChartCtx = {
    id, record, overview, refresh, go, discharged,
    canWrite: can("ipd", "write"),
    canNurse: can("nursing", "write") || can("ipd", "write"),
    isDoctor: user?.role === "Doctor" || user?.role === "Super Admin",
  };
  const due = overview?.stats.balanceDue ?? 0;
  const noteCount = notes.filter((n) => n.noteType !== "Diet").length;
  const allergy = overview?.allergyStatus ?? "";
  const day = overview?.live?.stayDay;

  return (
    <>
      <div className={`${tw.gutterX} mb-3 pt-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <Link href="/ipd" aria-label="Back to inpatients" className="mt-[3px] rounded-full p-1 text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"><ArrowLeft size={18} /></Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-semibold text-[color:var(--ink)]"><PatientName id={record.patientId} name={record.patientName} /></h1>
                <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">{record.patientId}</span>
                <StatusBadge status={record.status} />
                {record.isMlc && <Pill tone="bad">MLC</Pill>}
              </div>
              <p className="text-[12px] text-[color:var(--ink-soft)]">
                <span className="font-mono">{record.admissionNo}</span> · {record.ward}{record.bed ? ` · Bed ${record.bed}` : ""}{day ? ` · Day ${day}` : ""} · {record.admissionType}{record.doctor ? ` · ${record.doctor}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/billing" className={`${btn.base} ${due ? "bg-[#0b7a47] text-white hover:bg-[#096a3d]" : btn.ghost}`}><Banknote size={13} /> Bill{due ? ` · ${inr(due)} due` : ""}</Link>
            {ctx.canWrite && !discharged && <button className={`${btn.base} ${btn.ghost}`} onClick={() => setDialog("deposit")}>Take deposit</button>}
            {ctx.canWrite && !discharged && <button className={`${btn.base} ${btn.ghost}`} onClick={() => setDialog("bed")}><BedDouble size={13} /> Shift bed</button>}
            <button className={`${btn.base} ${btn.ghost}`} onClick={() => window.print()}><Printer size={13} /> Print</button>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 pl-[34px]">
          <button type="button" onClick={() => setDialog("allergy")} className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-3 py-[2px] text-[12px] ${allergy === "" ? "border-[#f3cf7d] bg-[#fff2d6] text-[#8a5300]" : allergy === "Has allergies" ? "border-[#f4a3ac] bg-[#ffe3e5] text-[#b3001b]" : "border-[#b9e5cd] bg-[#e6f7ee] text-[#0b7a47]"}`}>
            <ShieldAlert size={12} />{allergy === "" ? "Allergies not assessed" : allergy === "Has allergies" ? `Allergic: ${overview?.allergies}` : "No known allergies"}
          </button>
          {record.diagnosis && <Pill>{record.diagnosis}</Pill>}
          <button type="button" onClick={() => setDialog("payer")} className="cursor-pointer"><Pill tone={overview && overview.payer !== "Self pay" ? "info" : "neutral"}>Paid by {overview?.payer ?? "Self pay"}</Pill></button>
        </div>
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 500 }}>
          <nav aria-label="Patient chart" className="flex gap-1 overflow-x-auto border-b border-[color:var(--line)] px-3 sm:px-5">
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}
                className={`flex shrink-0 cursor-pointer items-center gap-[6px] whitespace-nowrap border-b-2 px-3 py-[13px] text-[13px] transition-colors ${tab === t.id ? "border-[color:var(--brand)] text-[color:var(--brand)]" : "border-transparent text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
                {t.label}
                {t.id === "rounds" && noteCount > 0 && <span className="rounded-full bg-[color:var(--brand)] px-[7px] text-[11px] leading-[18px] text-white">{noteCount}</span>}
                {t.id === "summary" && (overview?.todo.length ?? 0) > 0 && <span className="rounded-full bg-[#fff2d6] px-[7px] text-[11px] leading-[18px] text-[#8a5300]">{overview?.todo.length}</span>}
              </button>
            ))}
          </nav>
          {tab === "summary" && <SummaryTab ctx={ctx} />}
          {tab === "sheet" && <SheetTab ctx={ctx} />}
          {tab === "rounds" && <RoundsTab ctx={ctx} />}
          {tab === "medicines" && <DrugChartTab ctx={ctx} />}
          {tab === "io" && <IvIoTab ctx={ctx} />}
          {tab === "nursing" && <NursingTab ctx={ctx} />}
          {tab === "consents" && <ConsentsTab ctx={ctx} />}
          {tab === "insurance" && <InsuranceTab ctx={ctx} />}
          {tab === "discharge" && <DischargeTab ctx={ctx} />}
          {tab === "timeline" && <TimelineTab ctx={ctx} />}
        </div>
      </div>

      {dialog === "deposit" && <DepositDialog ctx={ctx} open onClose={() => setDialog("")} />}
      {dialog === "bed" && <ShiftBedDialog ctx={ctx} open onClose={() => setDialog("")} />}
      {dialog === "allergy" && <AllergyDialog ctx={ctx} open onClose={() => setDialog("")} />}
      {dialog === "payer" && <PayerDialog ctx={ctx} open onClose={() => setDialog("")} />}
    </>
  );
}
