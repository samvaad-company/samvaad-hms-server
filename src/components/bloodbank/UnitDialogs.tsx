"use client";

/** The four things done to a unit from the stock table: collect a new one, record its serology, process it, discard it. */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { BLOOD_COMPONENTS, SEROLOGY_TESTS, type BloodDonorDTO, type BloodUnitDTO, type SerologyKey } from "@/types/api";
import { DISCARD_REASONS, joinGroup, splitGroup, todayLocal } from "@/components/bloodbank/shared";

const SHELF: Record<string, number> = { "Whole blood": 35, PRBC: 42, Platelets: 5, Plasma: 365, Cryoprecipitate: 365 };
const VOLUME: Record<string, number> = { "Whole blood": 350, PRBC: 280, Platelets: 60, Plasma: 200, Cryoprecipitate: 20 };
const pill = (active: boolean) =>
  `h-[28px] px-3 rounded-full border text-[13px] cursor-pointer whitespace-nowrap transition-colors ${
    active ? "bg-[color:var(--subtle-2)] border-[color:var(--line)] text-[color:var(--ink)] font-medium" : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"
  }`;
const label = "text-[14px] font-medium text-[color:var(--ink)]";

const Footer = ({ onCancel, onSubmit, disabled, busy, verb, danger }: { onCancel: () => void; onSubmit: () => void; disabled: boolean; busy: boolean; verb: string; danger?: boolean }) => (
  <>
    <button onClick={onCancel} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer transition-colors">Cancel</button>
    <button onClick={onSubmit} disabled={disabled || busy} className={`h-[36px] rounded-[8px] px-5 text-[13px] font-medium text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${danger ? "bg-[#c8001a] hover:bg-[#a30015]" : "bg-[color:var(--brand)] hover:bg-[color:var(--brand-hover)]"}`}>
      {busy ? "Saving…" : verb}
    </button>
  </>
);

async function attempt(p: Promise<unknown>): Promise<boolean> {
  try { await p; return true; } catch { return false; }
}

// ── Collect ───────────────────────────────────────────────────────────────────

export function CollectDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const { items: donors } = useList<BloodDonorDTO>("/blood-bank/donors", { all: true });
  const { run, loading, error, reset } = useMutation();
  const [source, setSource] = useState<"Donation" | "Purchased">("Donation");
  const [donorId, setDonorId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [abo, setAbo] = useState("O");
  const [rh, setRh] = useState("+ve");
  const [component, setComponent] = useState("Whole blood");
  const [volume, setVolume] = useState("350");
  const [bagNo, setBagNo] = useState("");

  // A deferred donor, or one who gave blood too recently, can't be picked; the hint says why.
  const today = todayLocal();
  const usable = donors.filter((d) => d.status !== "Deferred" && !(d.nextEligibleOn && d.nextEligibleOn > today));
  const donor = donors.find((d) => String(d.id) === donorId);

  function pickDonor(id: string) {
    setDonorId(id);
    const d = donors.find((x) => String(x.id) === id);
    if (d) { const g = splitGroup(d.bloodGroup); setAbo(g.abo); setRh(g.rh); }
  }
  function pickComponent(c: string) { setComponent(c); setVolume(String(VOLUME[c] ?? 350)); }
  function close() { reset(); onClose(); }

  async function collect() {
    const ok = await attempt(run(() => api.post("/blood-bank/units", {
      source, donorId: source === "Donation" ? Number(donorId) : undefined, supplier: source === "Purchased" ? supplier.trim() : undefined,
      bloodGroup: joinGroup(abo, rh), component, volumeMl: Number(volume), bagNo: bagNo.trim(),
    })));
    if (!ok) return;
    setDonorId(""); setSupplier(""); setBagNo(""); pickComponent("Whole blood");
    onDone(); close();
  }
  const valid = (source === "Donation" ? Boolean(donorId) : supplier.trim().length > 1) && Number(volume) > 0;

  return (
    <Modal open={open} onClose={close} width={460} title="Collect a blood unit"
      subtitle="The unit number is minted on the server; the unit stays quarantined until ALL FIVE serology flags clear."
      footer={<Footer onCancel={close} onSubmit={collect} disabled={!valid} busy={loading} verb="Collect" />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className={label}>Source</span>
          <div className="flex gap-2" role="radiogroup" aria-label="Source">
            {(["Donation", "Purchased"] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={source === s} onClick={() => setSource(s)} className={pill(source === s)}>{s}</button>)}
          </div>
        </div>
        {source === "Donation" ? (
          <div className="flex flex-col gap-2">
            <span className={label}>Donor (deferred donors are blocked)</span>
            <SearchSelect placeholder="Pick the donor..." value={donorId} onChange={pickDonor}
              options={usable.map((d) => ({ value: String(d.id), label: `${d.name} · ${d.bloodGroup}`, hint: `${d.donorNo} ${d.phone}` }))} />
            {donors.length > usable.length && <p className="text-[12px] text-[color:var(--ink-soft)]">{donors.length - usable.length} donors are left out — deferred, or not yet due to donate again.</p>}
          </div>
        ) : (
          <div className="flex flex-col gap-2"><span className={label}>Supplier</span><FormInput placeholder="Blood centre the unit was bought from" value={supplier} onChange={setSupplier} /></div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2"><span className={label}>Group</span>
            <FormSelect value={abo} onChange={setAbo} options={["A", "B", "AB", "O"].map((g) => ({ value: g, label: g }))} />
          </div>
          <div className="flex flex-col gap-2"><span className={label}>Rh</span>
            <FormSelect value={rh} onChange={setRh} options={["+ve", "-ve"].map((g) => ({ value: g, label: g }))} />
          </div>
          <div className="flex flex-col gap-2"><span className={label}>Component</span>
            <FormSelect value={component} onChange={pickComponent} options={BLOOD_COMPONENTS.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex flex-col gap-2"><span className={label}>Volume (ml)</span><FormInput type="number" value={volume} onChange={setVolume} min="5" /></div>
        </div>
        <div className="flex flex-col gap-2"><span className={label}>Bag no (optional)</span><FormInput value={bagNo} onChange={setBagNo} /></div>
        {donor && source === "Donation" && <p className="text-[12px] text-[color:var(--ink-soft)]">Expires {SHELF[component]} days after collection.</p>}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

// ── Serology ──────────────────────────────────────────────────────────────────

export function SerologyDialog({ unit, onClose, onDone }: { unit: BloodUnitDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [flags, setFlags] = useState<Partial<Record<SerologyKey, "Negative" | "Reactive">>>({});
  const complete = SEROLOGY_TESTS.every((t) => flags[t.key]);
  const reactive = SEROLOGY_TESTS.filter((t) => flags[t.key] === "Reactive").map((t) => t.label);
  function close() { reset(); setFlags({}); onClose(); }
  async function record() {
    if (!(await attempt(run(() => api.post(`/blood-bank/units/${unit!.id}/serology`, flags))))) return;
    onDone(); close();
  }
  return (
    <Modal open={!!unit} onClose={close} width={460} title={unit ? `Record serology — ${unit.unitNo}` : ""}
      subtitle="All five results are needed. Any reactive result discards the unit and every component from the same donation."
      footer={<Footer onCancel={close} onSubmit={record} disabled={!complete} busy={loading} verb="Record" danger={reactive.length > 0} />}>
      <div className="flex flex-col gap-2">
        {SEROLOGY_TESTS.map((t) => (
          <div key={t.key} className="flex items-center justify-between rounded-[10px] border border-[color:var(--line)] px-4 py-2">
            <span className="text-[14px] font-medium text-[color:var(--ink)]">{t.label}</span>
            <div className="flex gap-2" role="radiogroup" aria-label={t.label}>
              {(["Negative", "Reactive"] as const).map((v) => (
                <button key={v} type="button" role="radio" aria-checked={flags[t.key] === v} onClick={() => setFlags((f) => ({ ...f, [t.key]: v }))}
                  className={`h-[28px] px-3 rounded-full border text-[13px] cursor-pointer transition-colors ${flags[t.key] === v
                    ? v === "Reactive" ? "bg-[#ffe3e5] border-[#f4a3ac] text-[#b3001b] font-medium" : "bg-[#dffff3] border-[#9fe3c6] text-[#0b7a47] font-medium"
                    : "bg-[color:var(--surface)] border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"}`}>{v}</button>
              ))}
            </div>
          </div>
        ))}
        {reactive.length > 0 && (
          <div role="alert" className="mt-1 flex gap-2 rounded-[10px] border border-[#f4a3ac] bg-[#ffe3e5] px-4 py-3 text-[13px] text-[#8f0016]">
            <AlertTriangle size={16} className="mt-[2px] shrink-0" /> Reactive for {reactive.join(", ")} — the unit will be discarded.
          </div>
        )}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

// ── Process ───────────────────────────────────────────────────────────────────

const PRODUCTS = ["PRBC", "Platelets", "Plasma"] as const;

export function ProcessDialog({ unit, onClose, onDone }: { unit: BloodUnitDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [chosen, setChosen] = useState<string[]>([...PRODUCTS]);
  function close() { reset(); onClose(); }
  async function process() {
    if (!(await attempt(run(() => api.post(`/blood-bank/units/${unit!.id}/process`, { components: chosen }))))) return;
    onDone(); close();
  }
  const expiry = (c: string) => {
    if (!unit) return "";
    const d = new Date(`${unit.collectedOn}T00:00:00`); d.setDate(d.getDate() + SHELF[c]);
    return d.toLocaleDateString("en-CA");
  };
  return (
    <Modal open={!!unit} onClose={close} width={440} title={unit ? `Process ${unit.unitNo}` : ""}
      subtitle="Separate the whole blood into components. The unit is closed and each product gets its own unit number and expiry."
      footer={<Footer onCancel={close} onSubmit={process} disabled={chosen.length === 0} busy={loading} verb="Process" />}>
      <div className="flex flex-col gap-2">
        {PRODUCTS.map((c) => (
          <label key={c} className="flex cursor-pointer items-center gap-3 rounded-[10px] border border-[color:var(--line)] px-4 py-3">
            <input type="checkbox" checked={chosen.includes(c)} onChange={(e) => setChosen((x) => (e.target.checked ? [...x, c] : x.filter((y) => y !== c)))} />
            <span className="flex-1 text-[14px] font-medium text-[color:var(--ink)]">{c}</span>
            <span className="font-mono text-[12px] text-[color:var(--ink-soft)]">expires {expiry(c)}</span>
          </label>
        ))}
        {unit && unit.status === "Quarantined" && <p className="text-[12px] text-[color:var(--ink-soft)]">This unit is still in quarantine, so its components will wait for serology too.</p>}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}

// ── Discard ───────────────────────────────────────────────────────────────────

export function DiscardDialog({ unit, onClose, onDone }: { unit: BloodUnitDTO | null; onClose: () => void; onDone: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [reason, setReason] = useState<string>(unit && unit.expired ? "Expired" : "");
  const [note, setNote] = useState("");
  function close() { reset(); setNote(""); onClose(); }
  async function discard() {
    if (!(await attempt(run(() => api.post(`/blood-bank/units/${unit!.id}/discard`, { reason, note: note.trim() }))))) return;
    onDone(); close();
  }
  return (
    <Modal open={!!unit} onClose={close} width={440} title={unit ? `Discard ${unit.unitNo}` : ""}
      subtitle="The unit leaves stock and goes on the Discard / Wastage Register."
      footer={<Footer onCancel={close} onSubmit={discard} disabled={!reason || (reason === "Other" && !note.trim())} busy={loading} verb="Discard" danger />}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2"><span className={label}>Reason</span>
          <FormSelect placeholder="Pick a reason" value={reason} onChange={setReason} options={DISCARD_REASONS.map((r) => ({ value: r, label: r }))} />
        </div>
        <div className="flex flex-col gap-2"><span className={label}>Note {reason === "Other" ? "" : "(optional)"}</span><FormInput value={note} onChange={setNote} placeholder="Anything the register should say" /></div>
        {unit?.status === "Cross-matched" && <p className="text-[12px] text-[#8a5300]">This unit is held by a cross-match — discarding it cancels that cross-match.</p>}
        {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[13px] text-[#c8001a]">{error.message}</p>}
      </div>
    </Modal>
  );
}
