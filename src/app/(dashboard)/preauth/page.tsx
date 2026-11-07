"use client";

/** Pre-authorisation forms: make one for a patient on any insurer's form, and follow it from draft through the doctor's signature and the hospital's stamp. */
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileCheck2, Plus } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Modal } from "@/components/shared/Modal";
import { FormRow } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { SignatureSetup } from "@/components/preauth/SignatureSetup";
import { PREAUTH_FORMS } from "@/lib/preauth/forms";
import type { DoctorDTO, PatientDTO } from "@/types/api";
import type { PreauthDTO, PreauthPendingDTO, PreauthSummaryDTO } from "@/types/preauth";

const COLUMNS = [
  { label: "Patient", width: "minmax(160px,1.4fr)" },
  { label: "Insurer / TPA", width: "minmax(180px,1.6fr)" },
  { label: "Doctor", width: "minmax(140px,1.2fr)" },
  { label: "Status", width: "150px" },
  { label: "Updated", width: "110px" },
];

export default function PreauthPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const canMake = can("tpa", "write");
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);

  const { item: forms, reload } = useItem<PreauthSummaryDTO[]>("/preauth");
  const { item: pending } = useItem<PreauthPendingDTO>("/preauth/pending");
  const all = forms ?? [];
  const count = (s: string) => all.filter((f) => f.status === s).length;
  const TABS = [
    { id: "all", label: "All", count: all.length },
    { id: "Draft", label: "Drafts", count: count("Draft") },
    { id: "Awaiting doctor", label: "Awaiting doctor", count: count("Awaiting doctor") },
    { id: "Awaiting stamp", label: "Awaiting stamp", count: count("Awaiting stamp") },
    { id: "Ready", label: "Ready", count: count("Ready") },
  ];
  const shown = tab === "all" ? all : all.filter((f) => f.status === tab);
  const waiting = (pending?.toSign.length ?? 0) + (pending?.toStamp.length ?? 0);

  return (
    <>
      <NewFormModal open={open} onClose={() => setOpen(false)} onCreated={(f) => { setOpen(false); reload(); router.push(`/preauth/${f.id}`); }} />
      <PageHeader title="Pre-auth forms" subtitle="Cashless hospitalisation requests on each insurer's own form, signed by the doctor and stamped by the hospital."
        stats={[{ icon: FileCheck2, value: String(waiting || all.length), label: waiting ? "Waiting for you" : "Forms" }]}
        action={canMake ? { label: "New pre-auth form", icon: Plus, onClick: () => setOpen(true) } : undefined} dateRange={false} />

      <div className={`${tw.gutterX} mb-5 flex flex-col gap-4`}>
        {waiting > 0 && (
          <div role="alert" className="rounded-[10px] border border-[#f3cf7d] bg-[#fff6dd] px-4 py-3 text-[13px] text-[#7a4a00] dark:border-[#5a4a1a] dark:bg-[#2a2412] dark:text-[#ffd27a]">
            <p className="font-medium">{pending!.toSign.length > 0 ? `${pending!.toSign.length} form${pending!.toSign.length === 1 ? "" : "s"} waiting for your signature` : `${pending!.toStamp.length} form${pending!.toStamp.length === 1 ? "" : "s"} waiting for the hospital stamp`}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[...pending!.toSign, ...pending!.toStamp].map((f) => (
                <button key={f.id} onClick={() => router.push(`/preauth/${f.id}`)} className="rounded-full border border-[#e3c27a] bg-white/70 px-3 py-[3px] text-[12px] hover:bg-white cursor-pointer dark:bg-transparent">{f.patientName} · {f.formName}</button>
              ))}
            </div>
          </div>
        )}
        {(user?.role === "Doctor" || user?.role === "Super Admin") && <SignatureSetup />}
      </div>

      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          <DataTable columns={COLUMNS} minWidth={800}>
            {shown.length === 0 ? (
              <div className="py-16 text-center text-[14px] text-[color:var(--ink-soft)]">{all.length === 0 ? "No pre-auth forms yet." : "Nothing here."}</div>
            ) : shown.map((f) => (
              <div key={f.id} role="button" tabIndex={0} onClick={() => router.push(`/preauth/${f.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/preauth/${f.id}`); }}
                className={`${tw.table.dataRow} cursor-pointer`} style={{ gridTemplateColumns: "var(--cols)" }}>
                <span className="truncate text-[13px] font-medium text-[color:var(--ink)]">{f.patientName}</span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{f.formName}</span>
                <span className="truncate text-[13px] text-[color:var(--ink)]">{f.doctorName || "—"}</span>
                <span><StatusBadge status={f.status} /></span>
                <span className="whitespace-nowrap text-[13px] text-[color:var(--ink-soft)]">{formatDate(f.updatedAt.slice(0, 10))}</span>
              </div>
            ))}
          </DataTable>
        </div>
      </div>
    </>
  );
}

function NewFormModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (f: PreauthDTO) => void }) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const [formKey, setFormKey] = useState("");
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const { run, loading, error, reset } = useMutation();

  const formOptions = useMemo(() => PREAUTH_FORMS.map((f) => ({ value: f.key, label: f.name, hint: f.kind })), []);
  const patientOptions = useMemo(() => patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` })), [patients]);
  const doctorOptions = useMemo(() => [{ value: "", label: "The patient's own doctor" }, ...doctors.map((d) => ({ value: String(d.id), label: d.name, hint: d.specialty }))], [doctors]);

  async function create() {
    const f = await run(() => api.post<PreauthDTO>("/preauth", { formKey, patientId: Number(patientId), ...(doctorId ? { doctorId: Number(doctorId) } : {}) }));
    if (f) { setFormKey(""); setPatientId(""); setDoctorId(""); onCreated(f); }
  }
  const close = () => { reset(); onClose(); };

  return (
    <Modal open={open} onClose={close} title="New pre-auth form" subtitle="Pick the insurer and the patient. The form is filled in from what the hospital already knows."
      footer={<>
        <button onClick={close} className="rounded-full border border-[color:var(--line)] px-5 py-[8px] text-[13px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
        <button onClick={create} disabled={loading || !formKey || !patientId} className="rounded-full bg-[color:var(--brand)] px-5 py-[8px] text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">{loading ? "Creating…" : "Create form"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <FormRow label="Insurance company / TPA *"><SearchSelect placeholder="Search 42 insurers and TPAs…" value={formKey} onChange={setFormKey} options={formOptions} /></FormRow>
        <FormRow label="Patient *"><SearchSelect placeholder="Search a patient…" value={patientId} onChange={setPatientId} options={patientOptions} /></FormRow>
        <FormRow label="Treating doctor (who will sign)"><SearchSelect placeholder="The patient's own doctor" value={doctorId} onChange={setDoctorId} options={doctorOptions} /></FormRow>
        {error && <p className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#ff0004]">{error.message}</p>}
      </div>
    </Modal>
  );
}
