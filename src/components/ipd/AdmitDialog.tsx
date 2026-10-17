"use client";

/**
 * Admit a patient. Only the patient is required — the bed, the doctor, the reason, the family contact, the
 * deposit and the nurse can all be filled in later. Six steps on one screen: patient, reason and doctor,
 * family contact, bed, deposit, primary nurse.
 */
import { useMemo, useState } from "react";
import { BedDouble, ChevronRight } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { done } from "@/components/ipd/nurse/shared";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";
import type { BedDTO, DepositMode, DoctorDTO, IpdAdmissionType, PatientDTO, StaffDTO, WardDTO } from "@/types/api";

const TYPES: IpdAdmissionType[] = ["Emergency", "Planned", "Day care", "Maternity", "Transfer in"];
const MODES: DepositMode[] = ["Cash", "UPI", "Card"];

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center justify-center w-[20px] h-[20px] rounded-full bg-[color:var(--subtle-2)] text-[11px] font-medium text-[color:var(--ink)]">{n}</span>
      <h3 className="text-[13px] font-medium text-[color:var(--ink)]">{title}</h3>
    </div>
  );
}

const pill = (active: boolean) =>
  `h-[30px] px-[14px] rounded-full border text-[13px] cursor-pointer whitespace-nowrap transition-colors ${
    active
      ? "bg-[color:var(--ink)] border-[color:var(--ink)] text-[color:var(--surface)]"
      : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]"
  }`;

export function AdmitDialog({
  open,
  onClose,
  onAdmitted,
  initialPatientId,
}: {
  open: boolean;
  onClose: () => void;
  onAdmitted: () => void;
  initialPatientId?: string;
}) {
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { items: doctors } = useList<DoctorDTO>("/doctors", { all: true });
  const { items: beds } = useList<BedDTO>("/beds", { all: true });
  const { items: wards } = useList<WardDTO>("/wards");
  // Not every role that can admit may read the staff list — the nurse picker then simply stays on "Assign later".
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const { run, loading, error, reset } = useMutation();

  const [patientId, setPatientId] = useState(initialPatientId ?? "");
  const [type, setType] = useState<IpdAdmissionType>("Planned");
  const [mlc, setMlc] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [family, setFamily] = useState({ name: "", relation: "", phone: "" });
  const [wardFilter, setWardFilter] = useState("");
  const [bedId, setBedId] = useState("");
  const [deposit, setDeposit] = useState("");
  const [mode, setMode] = useState<DepositMode>("Cash");
  const [nurseId, setNurseId] = useState("");
  const [moreOpen, setMoreOpen] = useState(false);
  const [stayDays, setStayDays] = useState("");
  const [diet, setDiet] = useState("");

  const free = useMemo(() => beds.filter((b) => b.status === "Available"), [beds]);
  const wardNames = useMemo(() => {
    const names = wards.length ? wards.map((w) => w.name) : [...new Set(beds.map((b) => b.ward))];
    return names.filter((n) => free.some((b) => b.ward === n));
  }, [wards, beds, free]);
  const shown = wardFilter ? free.filter((b) => b.ward === wardFilter) : free;
  const bed = beds.find((b) => String(b.id) === bedId);
  const nurses = staff.filter((s) => /nurse/i.test(s.role) && s.status === "Active");

  function close() {
    reset();
    onClose();
  }

  async function admit() {
    const patient = patients.find((p) => String(p.id) === patientId);
    if (!(await done(run(() =>
      api.post("/ipd", {
        patientId: Number(patientId),
        patientName: patient?.name ?? "",
        admissionType: type,
        isMlc: mlc,
        doctorId: doctorId ? Number(doctorId) : undefined,
        bedId: bedId ? Number(bedId) : undefined,
        diagnosis: reason.trim(),
        familyName: family.name.trim(),
        familyRelation: family.relation.trim(),
        familyPhone: family.phone.trim(),
        depositAmount: deposit ? Number(deposit) : 0,
        depositMode: deposit ? mode : undefined,
        primaryNurseId: nurseId ? Number(nurseId) : undefined,
        expectedStayDays: stayDays ? Number(stayDays) : undefined,
        diet: diet.trim(),
      }),
    )))) return;
    setPatientId(""); setType("Planned"); setMlc(false); setDoctorId(""); setReason("");
    setFamily({ name: "", relation: "", phone: "" }); setWardFilter(""); setBedId(""); setDeposit("");
    setMode("Cash"); setNurseId(""); setStayDays(""); setDiet(""); setMoreOpen(false);
    onAdmitted();
    close();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Admit patient"
      subtitle="Pick the patient and a bed - everything else is optional and can be filled in later."
      width={900}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="text-[12px] text-[color:var(--ink-soft)]">
            {bed ? <>Bed <span className="font-medium text-[color:var(--ink)]">{bed.bedNumber}</span> · {bed.dailyRate > 0 ? `${rupees(bed.dailyRate)}/day` : bed.ward}</> : "No bed yet"}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={close} className="h-[36px] px-5 rounded-[8px] text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">Cancel</button>
            <button onClick={admit} disabled={loading || !patientId}
              className="h-[36px] px-5 rounded-[8px] text-[13px] font-medium text-white bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? "Admitting…" : "Admit patient"}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-8" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        {/* Left: patient, reason & doctor, family */}
        <div className="flex flex-col gap-5">
          <section className="flex flex-col gap-2">
            <Step n={1} title="Patient" />
            <SearchSelect
              placeholder="Search patient…"
              value={patientId}
              onChange={setPatientId}
              options={patients.map((p) => ({ value: String(p.id), label: p.name, hint: `${p.patientId ?? ""} · ${p.phone}` }))}
            />
          </section>

          <section className="flex flex-col gap-3">
            <Step n={2} title="Reason & doctor" />
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Admission type">
              {TYPES.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={pill(type === t)}>{t}</button>
              ))}
            </div>
            <label className="flex items-center gap-3 cursor-pointer text-[13px] text-[color:var(--ink)]">
              <button type="button" role="switch" aria-checked={mlc} onClick={() => setMlc((v) => !v)}
                className={`relative w-[36px] h-[20px] rounded-full transition-colors cursor-pointer ${mlc ? "bg-[color:var(--brand)]" : "bg-[color:var(--subtle-2)]"}`}>
                <span className={`absolute top-[2px] left-[2px] w-[16px] h-[16px] rounded-full bg-white shadow transition-transform ${mlc ? "translate-x-[16px]" : ""}`} />
              </button>
              Medico-legal case (MLC) - police intimation needed
            </label>
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] font-medium text-[color:var(--ink)]">Consultant (admitting doctor)</span>
              <FormSelect placeholder="Pick a doctor" value={doctorId} onChange={setDoctorId} options={doctors.map((d) => ({ value: String(d.id), label: d.name }))} />
            </div>
            <div className="flex flex-col gap-[6px]">
              <span className="text-[13px] font-medium text-[color:var(--ink)]">Reason for admission</span>
              <FormTextarea placeholder="Working diagnosis, e.g. Acute gastroenteritis with dehydration" rows={3} value={reason} onChange={setReason} />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Step n={3} title="Family contact" />
            <div className="grid grid-cols-3 gap-2">
              <FormInput placeholder="Name" value={family.name} onChange={(v) => setFamily((f) => ({ ...f, name: v }))} />
              <FormInput placeholder="Relation" value={family.relation} onChange={(v) => setFamily((f) => ({ ...f, relation: v }))} />
              <FormInput placeholder="Phone" value={family.phone} onChange={(v) => setFamily((f) => ({ ...f, phone: v }))} />
            </div>
          </section>
        </div>

        {/* Right: bed, deposit, nurse */}
        <div className="flex flex-col gap-5 min-w-0">
          <section className="flex flex-col gap-2">
            <Step n={4} title="Bed" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setWardFilter("")} className={`${pill(wardFilter === "")} !bg-[color:var(--subtle)] ${wardFilter === "" ? "!text-[color:var(--ink)] !border-[color:var(--line)]" : ""}`}>
                All wards <span className="ml-1 text-[color:var(--ink-soft)]">{free.length}</span>
              </button>
              {wardNames.map((w) => (
                <button key={w} type="button" onClick={() => setWardFilter(w)} className={`${pill(wardFilter === w)} !bg-[color:var(--surface)] ${wardFilter === w ? "!text-[color:var(--ink)] !border-[color:var(--ink)]" : ""}`}>
                  {w} <span className="ml-1 text-[color:var(--ink-soft)]">{free.filter((b) => b.ward === w).length}</span>
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 overflow-y-auto pr-1" style={{ maxHeight: 232 }}>
              <button type="button" onClick={() => setBedId("")} aria-pressed={bedId === ""}
                className={`text-left rounded-[8px] border px-3 py-[10px] text-[13px] font-medium cursor-pointer ${bedId === "" ? "border-[color:var(--ink)] border-2" : "border-[color:var(--line)]"} bg-[color:var(--surface)] text-[color:var(--ink)]`}>
                Assign later
              </button>
              {shown.map((b) => (
                <button key={b.id} type="button" onClick={() => setBedId(String(b.id))} aria-pressed={bedId === String(b.id)}
                  className={`text-left rounded-[8px] border px-3 py-[8px] cursor-pointer bg-[color:var(--surface)] hover:bg-[color:var(--subtle)] ${bedId === String(b.id) ? "border-[color:var(--ink)] border-2" : "border-[color:var(--line)]"}`}>
                  <span className="flex items-center gap-[6px] font-mono text-[13px] font-semibold text-[color:var(--ink)]">
                    <BedDouble size={13} className="text-[color:var(--ink-soft)]" /> {b.bedNumber}
                  </span>
                  <span className="block text-[11px] text-[color:var(--ink-soft)]">{b.ward}</span>
                  {b.dailyRate > 0 && <span className="block font-mono text-[11px] text-[color:var(--ink)]">{rupees(b.dailyRate)}/day</span>}
                </button>
              ))}
            </div>
            {free.length === 0 && <p className="text-[12px] text-[color:var(--ink-soft)]">No beds are free right now — admit now and assign a bed later.</p>}
          </section>

          <section className="flex flex-col gap-2">
            <Step n={5} title="Admission deposit" />
            <div className="flex items-center gap-2">
              <div className="flex-1"><FormInput type="number" placeholder="₹  amount (optional)" value={deposit} onChange={setDeposit} min="0" /></div>
              <div role="radiogroup" aria-label="Deposit mode" className="inline-flex p-[3px] rounded-[8px] bg-[color:var(--subtle)] border border-[color:var(--line)]">
                {MODES.map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                    className={`h-[34px] px-3 rounded-[6px] text-[13px] cursor-pointer ${mode === m ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)]"}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <Step n={6} title="Primary nurse" />
            <FormSelect placeholder="Assign later" value={nurseId} onChange={setNurseId}
              options={[{ value: "", label: "Assign later" }, ...nurses.map((n) => ({ value: String(n.id), label: n.name }))]} />
          </section>

          <section className="rounded-[8px] border border-[color:var(--line)]">
            <button type="button" onClick={() => setMoreOpen((v) => !v)} aria-expanded={moreOpen}
              className="flex w-full items-center gap-2 px-3 h-[38px] text-[13px] text-[color:var(--ink)] cursor-pointer">
              <ChevronRight size={14} className={`transition-transform ${moreOpen ? "rotate-90" : ""}`} /> More - expected stay, diet
            </button>
            {moreOpen && (
              <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                <FormInput type="number" placeholder="Expected stay (days)" value={stayDays} onChange={setStayDays} min="0" />
                <FormInput placeholder="Diet, e.g. Soft, low salt" value={diet} onChange={setDiet} />
              </div>
            )}
          </section>
        </div>
      </div>
      {error && <div role="alert" className="mt-4 text-[13px] text-[#c8001a] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
    </Modal>
  );
}
