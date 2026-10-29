"use client";

/**
 * Enquiries — leads before registration. Capture who asked about what, contact them (each contact is
 * counted), then convert the lead into a registered patient or close it.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Inbox, Phone, Plus } from "lucide-react";
import { api } from "@/lib/api/client";
import { useItem, useList, useMutation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { formatDate, todayIso } from "@/lib/dates";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { DepartmentDTO, EnquiryDTO, EnquirySummaryDTO } from "@/types/api";

const FILTERS = ["All", "Open", "Contacted", "Converted", "Closed"] as const;
const SOURCES = ["Walk-in", "Phone call", "Referred by doctor", "Referred by patient", "Website / online", "Camp or event", "Advertisement", "Other"];

const STATUS_STYLE: Record<string, string> = {
  Contacted: "bg-[#fff6d6] text-[#9a5b00] border-[#f5df8a]",
  Open: "bg-[color:var(--subtle-2)] text-[color:var(--ink)] border-transparent",
  Converted: "bg-[#e8fbef] text-[#0b7a3b] border-[#b6e8cf]",
  Closed: "bg-[color:var(--surface)] text-[color:var(--ink-soft)] border-[color:var(--line)]",
};

const money = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Row({ e, canWrite, onContact, onConvert, onClose }: {
  e: EnquiryDTO; canWrite: boolean;
  onContact: (e: EnquiryDTO) => void; onConvert: (e: EnquiryDTO) => void; onClose: (e: EnquiryDTO) => void;
}) {
  const due = e.callBackOn && e.callBackOn <= todayIso();
  const actionBtn = "h-[24px] px-[10px] rounded-[6px] text-[11.5px] leading-none whitespace-nowrap cursor-pointer transition-colors";
  return (
    <div className="flex items-center gap-3 px-[11px] py-[7px] border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
      <span className="text-[13.5px] text-[color:var(--ink)] truncate min-w-0 flex-1" title={e.interestedIn || undefined}>{e.name}</span>

      <div className="flex items-center gap-[10px] shrink-0">
        <span className={`inline-flex items-center h-[20px] px-[9px] rounded-full text-[11px] border ${STATUS_STYLE[e.status] ?? STATUS_STYLE.Open}`}>{e.status}</span>
        {e.mobile && (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-mono text-[color:var(--ink-soft)]"><Phone size={11} strokeWidth={1.5} />{e.mobile}</span>
        )}
        <span className="text-[12px] font-mono font-semibold text-[color:var(--ink)]">{money(e.estimatedValue)}</span>
        {e.callBackOn && (
          <span className={`text-[11.5px] font-mono ${due ? "text-[#e0001b]" : "text-[color:var(--ink-soft)]"}`}>
            call back {formatDate(e.callBackOn).replace(/^(\d) /, "0$1 ")}
          </span>
        )}
        <span title="Times contacted so far" className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-[6px] rounded-full bg-[color:var(--subtle-2)] text-[11px] text-[color:var(--ink)]">{e.contacts}</span>

        {e.status === "Converted" ? (
          e.convertedPatientId ? (
            <Link href={`/patients/${e.convertedPatientId}`} className="inline-flex items-center gap-[3px] text-[11.5px] text-[color:var(--ink)] hover:text-[color:var(--brand)]">
              Patient <ArrowUpRight size={11} />
            </Link>
          ) : null
        ) : canWrite ? (
          <>
            <button type="button" onClick={() => onContact(e)} className={`${actionBtn} border border-[color:var(--line)] bg-[color:var(--surface)] text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`}>Log contact</button>
            <button type="button" onClick={() => onConvert(e)} className={`${actionBtn} bg-[color:var(--brand-soft)] text-[color:var(--brand)] font-medium hover:brightness-95`}>Convert</button>
            {e.status !== "Closed" && (
              <button type="button" onClick={() => onClose(e)} className={`${actionBtn} text-[color:var(--ink)] hover:bg-[color:var(--subtle)]`}>Close</button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

const BLANK = { name: "", mobile: "", department: "", interestedIn: "", source: "", estimatedValue: "", callBackOn: "", notes: "" };

function NewEnquiryModal({ departments, onClose, onSaved }: { departments: DepartmentDTO[]; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [form, setForm] = useState({ ...BLANK, department: departments.find(d => /general/i.test(d.name))?.name ?? departments[0]?.name ?? "" });
  const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    await run(() => api.post("/enquiries", { ...form, estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : 0 }));
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title="New enquiry" width={440}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button onClick={save} disabled={loading || form.name.trim().length < 2}
            className="text-[13px] font-medium text-white bg-[color:var(--brand)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
            {loading ? "Saving…" : "Save enquiry"}
          </button>
        </>
      }>
      <p className="-mt-1 mb-4 text-[13px] text-[color:var(--ink-soft)]">A lead, not a registration — no UHID until you convert.</p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        <FormRow label="Name" required><FormInput value={form.name} onChange={v => set("name", v)} /></FormRow>
        <FormRow label="Mobile"><FormInput type="tel" value={form.mobile} onChange={v => set("mobile", v)} /></FormRow>
        <FormRow label="Department">
          <FormSelect value={form.department} onChange={v => set("department", v)} placeholder="Select department"
            options={departments.map(d => ({ value: d.name, label: d.name }))} />
        </FormRow>
        <FormRow label="Interested in"><FormInput placeholder="e.g. Knee replacement" value={form.interestedIn} onChange={v => set("interestedIn", v)} /></FormRow>
        <FormRow label="Source">
          <FormSelect value={form.source} onChange={v => set("source", v)} placeholder="Referred by…" options={SOURCES.map(s => ({ value: s, label: s }))} />
        </FormRow>
        <FormRow label="Estimated value ₹"><FormInput type="number" value={form.estimatedValue} onChange={v => set("estimatedValue", v)} /></FormRow>
        <FormRow label="Call back on"><FormInput type="date" value={form.callBackOn} min={todayIso()} onChange={v => set("callBackOn", v)} /></FormRow>
        <FormRow label="Notes"><FormInput value={form.notes} onChange={v => set("notes", v)} /></FormRow>
      </div>
      {error && <p className="mt-3 text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
    </Modal>
  );
}

function ContactModal({ enquiry, onClose, onSaved }: { enquiry: EnquiryDTO; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [note, setNote] = useState("");
  const [nextOn, setNextOn] = useState("");

  async function save() {
    await run(() => api.post(`/enquiries/${enquiry.id}/contact`, { note, nextOn }));
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Log contact — ${enquiry.name}`} width={440}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button onClick={save} disabled={loading}
            className="text-[13px] font-medium text-white bg-[color:var(--brand)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
            {loading ? "Saving…" : "Log contact"}
          </button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <p className="text-[12px] text-[color:var(--ink-soft)]">
          {enquiry.interestedIn || "Enquiry"} · contacted {enquiry.contacts} time{enquiry.contacts === 1 ? "" : "s"} so far
        </p>
        {enquiry.history.length > 0 && (
          <ul className="max-h-[120px] overflow-y-auto flex flex-col gap-1 rounded-[8px] bg-[color:var(--faint)] border border-[color:var(--line)] px-3 py-2">
            {enquiry.history.slice().reverse().map((h, i) => (
              <li key={i} className="text-[12px] text-[color:var(--ink)]">
                <span className="text-[color:var(--ink-soft)]">{formatDate(h.at.slice(0, 10))} · {h.by}: </span>{h.note || "Contacted"}
              </li>
            ))}
          </ul>
        )}
        <FormRow label="What was said"><FormInput placeholder="e.g. Called, will decide on Friday" value={note} onChange={setNote} /></FormRow>
        <FormRow label="Call back on" hint="Leave empty if nothing is planned."><FormInput type="date" value={nextOn} min={todayIso()} onChange={setNextOn} /></FormRow>
        {error && <p className="text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
      </div>
    </Modal>
  );
}

function CloseModal({ enquiry, onClose, onSaved }: { enquiry: EnquiryDTO; onClose: () => void; onSaved: () => void }) {
  const { run, loading, error } = useMutation();
  const [reason, setReason] = useState("");

  async function save() {
    await run(() => api.post(`/enquiries/${enquiry.id}/close`, { reason }));
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={`Close — ${enquiry.name}`} width={420}
      footer={
        <>
          <button onClick={onClose} className="text-[13px] text-[color:var(--ink)] border border-[color:var(--line)] px-4 py-[6px] rounded-[8px] hover:bg-[color:var(--subtle)] cursor-pointer">Cancel</button>
          <button onClick={save} disabled={loading}
            className="text-[13px] font-medium text-white bg-[#e0001b] px-4 py-[6px] rounded-[8px] hover:brightness-95 disabled:opacity-50 cursor-pointer">
            {loading ? "Closing…" : "Close enquiry"}
          </button>
        </>
      }>
      <div className="flex flex-col gap-3">
        <p className="text-[13px] text-[color:var(--ink-soft)]">The lead stays on file. You can contact or convert it later.</p>
        <FormRow label="Reason (optional)"><FormInput placeholder="e.g. Went to another hospital" value={reason} onChange={setReason} /></FormRow>
        {error && <p className="text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</p>}
      </div>
    </Modal>
  );
}

export default function EnquiriesPage() {
  const router = useRouter();
  const { can } = useAuth();
  const canWrite = can("enquiries", "write");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [modal, setModal] = useState<null | { kind: "new" } | { kind: "contact"; e: EnquiryDTO } | { kind: "close"; e: EnquiryDTO }>(null);

  const params = filter === "All" ? { all: true } : { all: true, status: filter };
  const { items, loading, reload } = useList<EnquiryDTO>("/enquiries", params);
  const { item: summary, reload: reloadSummary } = useItem<EnquirySummaryDTO>("/enquiries/summary");
  const { items: departments } = useList<DepartmentDTO>("/departments", { all: true });

  const refresh = () => { reload(); reloadSummary(); };

  /** Registering happens on the full patient form, prefilled; it links the patient back to this lead. */
  function convert(e: EnquiryDTO) {
    const q = new URLSearchParams({ enquiry: String(e.id), name: e.name, mobile: e.mobile, interest: e.interestedIn });
    router.push(`/patients/new?${q.toString()}`);
  }

  const due = summary?.dueToday ?? 0;

  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[color:var(--line)]">
        <Inbox size={15} strokeWidth={1.5} className="text-[color:var(--ink-soft)] shrink-0" />
        <h1 className="text-[14px] font-semibold text-[color:var(--ink)] shrink-0">Enquiries</h1>
        <p className="text-[12px] text-[color:var(--ink-soft)] truncate min-w-0">
          Leads before registration — capture, contact, convert.{due > 0 && ` ${due} due today.`}
        </p>
        {canWrite && (
          <button onClick={() => setModal({ kind: "new" })}
            className="ml-auto inline-flex items-center gap-[6px] h-[30px] px-3 rounded-[8px] bg-[color:var(--brand)] text-white text-[12.5px] font-medium hover:bg-[color:var(--brand-hover)] cursor-pointer shrink-0">
            <Plus size={14} /> New enquiry
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-5 py-[10px] border-b border-[color:var(--line)] flex-wrap">
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
            className={`h-[24px] px-3 rounded-full text-[12px] border transition-colors cursor-pointer ${
              filter === f ? "border-[color:var(--brand)] text-[color:var(--ink)] bg-[color:var(--brand-soft)] font-medium" : "border-[color:var(--line)] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)]"
            }`}>
            {f}
          </button>
        ))}
      </div>

      <div className="p-4">
        <div className="rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-[color:var(--ink-soft)]">Loading enquiries…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-[13px] text-[color:var(--ink-soft)]">
              {filter === "All" ? "No enquiries yet." : `No ${filter.toLowerCase()} enquiries.`}
              {canWrite && filter === "All" && <> <button onClick={() => setModal({ kind: "new" })} className="text-[color:var(--brand)] underline cursor-pointer">Add the first one</button>.</>}
            </div>
          ) : items.map(e => (
            <Row key={e.id} e={e} canWrite={canWrite}
              onContact={e => setModal({ kind: "contact", e })} onConvert={convert} onClose={e => setModal({ kind: "close", e })} />
          ))}
        </div>
      </div>

      {modal?.kind === "new" && <NewEnquiryModal departments={departments} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === "contact" && <ContactModal enquiry={modal.e} onClose={() => setModal(null)} onSaved={refresh} />}
      {modal?.kind === "close" && <CloseModal enquiry={modal.e} onClose={() => setModal(null)} onSaved={refresh} />}
    </>
  );
}
