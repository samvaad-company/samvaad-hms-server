"use client";

/**
 * Donor registry. ID proofs are shown — and stored — as the type and the last four characters only. A donor can be
 * deferred (for a reason, until a date or until lifted) and the deferral lifted again.
 */
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { useHydrated } from "@/lib/use-hydrated";
import { usePagination } from "@/components/shared/Pagination";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { DONOR_ID_PROOFS, type BloodDonorDTO } from "@/types/api";
import { btn, Empty, ID_PROOF_LABELS, joinGroup, mono, Pill, SectionHead, td, th, todayLocal } from "@/components/bloodbank/shared";

const label = "text-[14px] font-medium text-[color:var(--ink)]";
async function attempt(p: Promise<unknown>) { try { await p; return true; } catch { return false; } }

function RegisterDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const blank = { name: "", gender: "Male", abo: "O", rh: "+ve", dob: "", phone: "", idType: "", last4: "" };
  const [f, setF] = useState(blank);
  const set = <K extends keyof typeof blank>(k: K, v: string) => setF((x) => ({ ...x, [k]: v }));
  const close = () => { reset(); onClose(); };
  async function register() {
    const ok = await attempt(run(() => api.post("/blood-bank/donors", {
      name: f.name.trim(), gender: f.gender, bloodGroup: joinGroup(f.abo, f.rh), dob: f.dob, phone: f.phone.trim(),
      idProofType: f.idType || undefined, idProofLast4: f.last4 || undefined,
    })));
    if (!ok) return;
    setF(blank); onDone(); close();
  }
  const idOk = Boolean(f.idType) === Boolean(f.last4) && (!f.last4 || /^[A-Za-z0-9]{4}$/.test(f.last4));
  return (
    <Modal open={open} onClose={close} width={460} title="Register a blood donor"
      subtitle="The ID proof is PHI-grade: only the TYPE and LAST 4 characters are stored - never the full number."
      footer={<>
        <button onClick={close} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
        <button onClick={register} disabled={loading || f.name.trim().length < 2 || !f.dob || f.phone.trim().length < 7 || !idOk} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Saving…" : "Register"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={label}>Name</span><FormInput value={f.name} onChange={(v) => set("name", v)} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-2"><span className={label}>Gender</span><FormSelect value={f.gender} onChange={(v) => set("gender", v)} options={["Male", "Female", "Other"].map((g) => ({ value: g, label: g }))} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Group</span><FormSelect value={f.abo} onChange={(v) => set("abo", v)} options={["A", "B", "AB", "O"].map((g) => ({ value: g, label: g }))} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Rh</span><FormSelect value={f.rh} onChange={(v) => set("rh", v)} options={["+ve", "-ve"].map((g) => ({ value: g, label: g }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-2"><span className={label}>Date of birth</span><FormInput type="date" value={f.dob} onChange={(v) => set("dob", v)} max={todayLocal()} /></div>
          <div className="flex flex-col gap-2"><span className={label}>Mobile</span><FormInput value={f.phone} onChange={(v) => set("phone", v)} /></div>
          <div className="flex flex-col gap-2"><span className={label}>ID proof type</span>
            <FormSelect placeholder="Aadhaar / PAN / DL..." value={f.idType} onChange={(v) => set("idType", v)} options={[{ value: "", label: "None" }, ...DONOR_ID_PROOFS.map((t) => ({ value: t, label: ID_PROOF_LABELS[t] }))]} />
          </div>
          <div className="flex flex-col gap-2"><span className={label}>ID proof - LAST 4 only</span><FormInput value={f.last4} onChange={(v) => set("last4", v.slice(0, 4))} placeholder="····" /></div>
        </div>
        {!idOk && <p className="text-[12px] text-[#c8001a]">Give both the ID type and exactly 4 characters, or neither.</p>}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

function DeferDialog({ donor, onClose, onDone }: { donor: BloodDonorDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [reason, setReason] = useState("");
  const [until, setUntil] = useState("");
  const close = () => { reset(); setReason(""); setUntil(""); onClose(); };
  async function defer() {
    if (!(await attempt(run(() => api.post(`/blood-bank/donors/${donor!.id}/defer`, { reason: reason.trim(), until: until || undefined }))))) return;
    onDone(); close();
  }
  return (
    <Modal open={!!donor} onClose={close} width={420} title={donor ? `Defer ${donor.name}` : ""} subtitle="A deferred donor can't donate. Leave the date empty to keep it until someone lifts it."
      footer={<>
        <button onClick={close} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
        <button onClick={defer} disabled={loading || reason.trim().length < 3} className="h-[36px] rounded-[8px] bg-[color:var(--brand)] px-5 text-[13px] font-medium text-white hover:bg-[color:var(--brand-hover)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">{loading ? "Saving…" : "Defer"}</button>
      </>}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={label}>Reason</span><FormInput placeholder="e.g. Low haemoglobin, recent fever" value={reason} onChange={setReason} /></div>
        <div className="flex flex-col gap-2"><span className={label}>Until (optional)</span><FormInput type="date" value={until} min={todayLocal()} onChange={setUntil} /></div>
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

export function DonorsView({ canWrite }: { canWrite: boolean }) {
  const hydrated = useHydrated();
  const { items: donors, reload, loading } = useList<BloodDonorDTO>("/blood-bank/donors", { all: true });
  const { run } = useMutation();
  const [q, setQ] = useState("");
  const [registering, setRegistering] = useState(false);
  const [deferring, setDeferring] = useState<BloodDonorDTO | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = donors.filter((d) => !needle || [d.name, d.donorNo, d.phone, d.bloodGroup].some((v) => v.toLowerCase().includes(needle)));
  const { rows, bar } = usePagination(shown, "donors");

  return (
    <div>
      <SectionHead title="Donor registry" count={donors.length}
        action={hydrated && canWrite ? <button onClick={() => setRegistering(true)} className={btn.primary}><UserPlus size={14} /> Register donor</button> : undefined} />
      <div className="px-5 pb-3">
        <div className="relative w-[300px] max-w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, donor no, mobile, group" aria-label="Search donors"
            className="h-[34px] w-full rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-[32px] pr-3 text-[13px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:outline-none focus:border-[color:var(--brand)]" />
        </div>
      </div>
      <div className="mx-5 mb-4 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[960px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["Donor", "Name", "Group", "Mobile", "ID proof", "Donations", "Last", "Status", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} ${mono}`}>{d.donorNo}</td>
                <td className={`${td} font-medium`}>{d.name}</td>
                <td className={td}>{d.bloodGroup}</td>
                <td className={`${td} ${mono}`}>{d.phone}</td>
                <td className={`${td} ${mono}`}>{d.idProofType ? `${d.idProofType} ····${d.idProofLast4}` : "-"}</td>
                <td className={`${td} ${mono}`}>{d.totalDonations}</td>
                <td className={`${td} ${mono}`} title={d.nextEligibleOn ? `Next eligible ${d.nextEligibleOn}` : undefined}>{d.lastDonationDate || "-"}</td>
                <td className={td}><span title={d.deferralReason ? `${d.deferralReason}${d.deferredUntil ? ` · until ${d.deferredUntil}` : ""}` : undefined}><Pill tone={d.status}>{d.status}</Pill></span></td>
                <td className={`${td} text-right`}>
                  {canWrite && (d.status === "Deferred"
                    ? <button onClick={async () => { if (await attempt(run(() => api.post(`/blood-bank/donors/${d.id}/lift`)))) reload(); }} className={`${btn.base} ${btn.ghost}`}>Lift deferral</button>
                    : <button onClick={() => setDeferring(d)} className={`${btn.base} ${btn.ghost}`}>Defer</button>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && shown.length === 0 && <Empty>{donors.length === 0 ? "No donors registered yet." : "No donors match."}</Empty>}
      </div>
      {bar}
      <RegisterDialog open={registering} onClose={() => setRegistering(false)} onDone={reload} />
      <DeferDialog key={deferring?.id} donor={deferring} onClose={() => setDeferring(null)} onDone={reload} />
    </div>
  );
}
