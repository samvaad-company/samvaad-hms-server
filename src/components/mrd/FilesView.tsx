"use client";

/**
 * File tracking → Files. Every patient file (F/2026/00017): where it is, who has it and when it is due back.
 * Checkout, return, archive, retrieve and move write to the file's trail; the clock icon shows it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { History, LogIn, LogOut, ArchiveRestore, Loader2, Search } from "lucide-react";
import { api } from "@/lib/api/client";
import { useInfiniteList, useList, useMutation } from "@/lib/api/hooks";
import { Modal } from "@/components/shared/Modal";
import { RowMenu } from "@/components/shared/RowMenu";
import { FormInput, FormSelect } from "@/components/shared/FormRow";
import type { MrdFileDTO, MrdFileMovementDTO, MrdLocationDTO } from "@/types/api";
import { attempt, DialogButtons, dmy, Empty, ErrorNote, fieldLabel, mono, outlineBtn, Pill, plusDays, softBtn, stampShort, td, th, todayLocal } from "@/components/mrd/shared";

type Kind = "checkout" | "return" | "archive" | "move";

const TITLE: Record<Kind, string> = { checkout: "Check out file", return: "Return file", archive: "Archive file", move: "Move file" };
const CONFIRM: Record<Kind, string> = { checkout: "Check out", return: "Return", archive: "Archive", move: "Move" };

function FileActionDialog({ file, kind, locations, onClose }: { file: MrdFileDTO | null; kind: Kind | null; locations: MrdLocationDTO[]; onClose: () => void }) {
  const { run, loading, error, reset } = useMutation();
  const [holder, setHolder] = useState("");
  const [dueOn, setDueOn] = useState(plusDays(7));
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  if (!file || !kind) return null;

  const live = locations.filter((l) => l.active);
  const options = (kind === "archive" ? live.filter((l) => l.kind === "Archive room") : live.filter((l) => l.kind !== "Archive room" && (kind !== "move" || l.id !== file.locationId)));
  // The first sensible place unless the user chose one: the home rack on return, the first archive room on archive.
  const fallback = kind === "return" ? String(file.homeLocationId ?? options[0]?.id ?? "") : String(options[0]?.id ?? "");
  const locationId = picked ?? (kind === "checkout" || kind === "move" ? picked ?? "" : fallback);
  const close = () => { reset(); onClose(); };

  async function submit() {
    const body: Record<string, unknown> = { note: note.trim() || undefined };
    if (locationId) body.locationId = Number(locationId);
    if (kind === "checkout") { body.holder = holder.trim(); body.dueOn = dueOn; }
    if (await attempt(run(() => api.post(`/mrd/files/${file!.id}/${kind}`, body)))) close();
  }
  const ready = kind === "checkout" ? holder.trim().length >= 2 && !!locationId && !!dueOn : kind === "move" ? !!locationId : kind === "archive" ? !!locationId : true;

  return (
    <Modal open onClose={close} width={440} title={`${TITLE[kind]} - ${file.fileNo}`} subtitle={`${file.patientName} · ${file.patientCode}`}
      footer={<DialogButtons onCancel={close} onConfirm={submit} label={CONFIRM[kind]} loading={loading} disabled={!ready} />}>
      <div className="flex flex-col gap-4">
        {kind === "checkout" && (
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Holder</span><FormInput value={holder} onChange={setHolder} placeholder="Who is taking the file?" /></div>
        )}
        <div className="flex flex-col gap-2">
          <span className={fieldLabel}>{kind === "return" ? "Return to" : kind === "archive" ? "Archive room" : kind === "move" ? "Move to" : "Take it to"}</span>
          <FormSelect value={locationId} onChange={(v) => setPicked(v)} placeholder="Choose a location" options={options.map((l) => ({ value: String(l.id), label: l.name }))} />
          {kind === "archive" && options.length === 0 && <p className="text-[12px] text-[#c8001a]">There is no archive room — add one under Locations first.</p>}
        </div>
        {kind === "checkout" && (
          <div className="flex flex-col gap-2"><span className={fieldLabel}>Due back</span><FormInput type="date" value={dueOn} onChange={setDueOn} min={todayLocal()} /></div>
        )}
        <div className="flex flex-col gap-2"><span className={fieldLabel}>Note (optional)</span><FormInput value={note} onChange={setNote} /></div>
        <ErrorNote message={error?.message} />
      </div>
    </Modal>
  );
}

function HistoryDialog({ file, onClose }: { file: MrdFileDTO | null; onClose: () => void }) {
  const { items, loading } = useList<MrdFileMovementDTO>(file ? `/mrd/files/${file.id}/history` : null);
  if (!file) return null;
  return (
    <Modal open onClose={onClose} width={760} title={`History - ${file.fileNo}`} subtitle={`${file.patientName} · every time the file was handed out, brought back, moved or archived`}
      footer={<button onClick={onClose} className="h-[36px] rounded-[8px] border border-[color:var(--line)] bg-[color:var(--surface)] px-5 text-[13px] font-medium cursor-pointer hover:bg-[color:var(--subtle)]">Close</button>}>
      <div className="overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[640px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["When", "Action", "From → To", "Holder", "Due", "By"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((m) => (
              <tr key={m.id} className="border-b border-[color:var(--line)] last:border-b-0 align-top">
                <td className={`${td} ${mono} whitespace-nowrap`}>{stampShort(m.at)}</td>
                <td className={td}>{m.action}{m.note && <span className="block text-[12px] text-[color:var(--ink-soft)]">{m.note}</span>}</td>
                <td className={td}>{m.fromLocation ? `${m.fromLocation} → ` : ""}{m.toLocation || "-"}</td>
                <td className={td}>{m.holderName ?? "-"}</td>
                <td className={`${td} ${mono}`}>{m.dueOn ? dmy(m.dueOn) : "-"}</td>
                <td className={td}>{m.byName}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>No movements recorded.</Empty>}
      </div>
    </Modal>
  );
}

export function FilesView({ canWrite }: { canWrite: boolean }) {
  const [typed, setTyped] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => { const t = setTimeout(() => setTerm(typed.trim()), 250); return () => clearTimeout(t); }, [typed]);
  const params = useMemo(() => (term ? { search: term } : {}), [term]);
  const { items, total, loading, loadingMore, hasMore, error, loadMore } = useInfiniteList<MrdFileDTO>("/mrd/files", params, 40);
  const { items: locations } = useList<MrdLocationDTO>("/mrd/locations");
  const { run, error: actionError, reset } = useMutation();
  const [dialog, setDialog] = useState<{ file: MrdFileDTO; kind: Kind } | null>(null);
  const [history, setHistory] = useState<MrdFileDTO | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const end = endRef.current;
    if (!end || !hasMore) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: "240px" });
    io.observe(end);
    return () => io.disconnect();
  }, [hasMore, loadMore, items.length]);

  async function retrieve(f: MrdFileDTO) { reset(); await attempt(run(() => api.post(`/mrd/files/${f.id}/retrieve`, {}))); }

  return (
    <div className="px-5 pb-5 pt-4">
      <label className="relative block max-w-[390px]">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--ink-soft)]" />
        <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Search by patient name, UHID or file number..." aria-label="Search files"
          className="h-[40px] w-full rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] pl-9 pr-3 text-[14px] text-[color:var(--ink)] placeholder:text-[color:var(--ink-soft)] focus:border-[color:var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand-ring)]" />
      </label>
      <div className="mt-3"><ErrorNote message={actionError?.message ?? error?.message} /></div>
      <div className="mt-3 overflow-x-auto rounded-[10px] border border-[color:var(--line)]">
        <table className="w-full min-w-[1020px] text-left">
          <thead><tr className="border-b border-[color:var(--line)]">{["File no", "Patient", "Type", "Status", "Location", "Holder", "Due", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.id} className="border-b border-[color:var(--line)] last:border-b-0 hover:bg-[color:var(--faint)]">
                <td className={`${td} ${mono} whitespace-nowrap`}>{f.fileNo}</td>
                <td className={td}>{f.patientName} <span className={`${mono} text-[12px] text-[color:var(--ink-soft)]`}>{f.patientCode}</span></td>
                <td className={td}>{f.fileType}</td>
                <td className={td}><Pill>{f.status}</Pill></td>
                <td className={td}>{f.locationName || "-"}</td>
                <td className={td}>{f.holderName ?? "—"}</td>
                <td className={`${td} ${f.overdue ? "font-medium text-[#c8001a]" : ""}`}>{f.dueOn ? dmy(f.dueOn) : "—"}</td>
                <td className={`${td} text-right`}>
                  <div className="flex items-center justify-end gap-2">
                    {canWrite && (f.status === "Checked out" || f.status === "In transit") && <button onClick={() => { reset(); setDialog({ file: f, kind: "return" }); }} className={softBtn}><LogIn size={14} /> Return</button>}
                    {canWrite && f.status === "Available" && <button onClick={() => { reset(); setDialog({ file: f, kind: "checkout" }); }} className={softBtn}><LogOut size={14} /> Checkout</button>}
                    {canWrite && f.status === "Available" && <RowMenu compact actions={[{ label: "Archive", onClick: () => setDialog({ file: f, kind: "archive" }) }, { label: "Move to…", onClick: () => setDialog({ file: f, kind: "move" }) }]} />}
                    {canWrite && f.status === "Archived" && <button onClick={() => retrieve(f)} className={outlineBtn}><ArchiveRestore size={14} /> Retrieve</button>}
                    <button onClick={() => setHistory(f)} aria-label={`History of ${f.fileNo}`} title="History" className="grid h-[30px] w-[30px] place-items-center rounded-[8px] text-[color:var(--ink-soft)] hover:bg-[color:var(--subtle)] cursor-pointer"><History size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <Empty>{term ? "No files match that search." : "No patient files yet."}</Empty>}
        {loading && items.length === 0 && <div className="flex justify-center py-10"><Loader2 className="animate-spin text-[color:var(--ink-soft)]" size={18} /></div>}
      </div>
      <div ref={endRef} className="flex h-8 items-center justify-center text-[12px] text-[color:var(--ink-soft)]">
        {loadingMore ? <Loader2 className="animate-spin" size={14} /> : !hasMore && items.length > 0 ? `${total} ${total === 1 ? "file" : "files"}` : null}
      </div>
      <FileActionDialog key={`${dialog?.file.id}-${dialog?.kind}`} file={dialog?.file ?? null} kind={dialog?.kind ?? null} locations={locations} onClose={() => setDialog(null)} />
      <HistoryDialog key={`h${history?.id}`} file={history} onClose={() => setHistory(null)} />
    </div>
  );
}
