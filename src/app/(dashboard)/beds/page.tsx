"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import {
  Plus, ArrowRight, BedSingle, UserRound, Pencil, Trash2, ArrowRightLeft, LogOut, UserPlus,
} from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import type { BedDTO, WardDTO, BedTransferDTO, PatientDTO } from "@/types/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";
import type { BedStatus } from "@/types";

// ─── Bed status styling ───────────────────────────────────────────────────────

const STATUSES: BedStatus[] = ["Available", "Occupied", "Reserved", "Maintenance"];

const STATUS_BG: Record<string, string> = {
  Available:   "bg-[#dffff3] border-[#b8f0d9]",
  Occupied:    "bg-[#ffe9e9] border-[#ffc8c8]",
  Reserved:    "bg-[#fff2e0] border-[#ffd99a]",
  Maintenance: "bg-[#f0f0f0] border-[#dedee1]",
};

const STATUS_DOT: Record<string, string> = {
  Available:   "bg-[#00955c]",
  Occupied:    "bg-[#ff0004]",
  Reserved:    "bg-[#ff9000]",
  Maintenance: "bg-[#57575f]",
};

const STATUS_TEXT: Record<string, string> = {
  Available:   "text-[#00955c]",
  Occupied:    "text-[#ff0004]",
  Reserved:    "text-[#ff9000]",
  Maintenance: "text-[#57575f]",
};

const STATUS_CHIP: Record<string, string> = {
  Available:   "bg-[#dffff3] text-[#00955c]",
  Occupied:    "bg-[#ffe9e9] text-[#ff0004]",
  Reserved:    "bg-[#fff2e0] text-[#ff9000]",
  Maintenance: "bg-[#f0f0f0] text-[#57575f]",
};

function BedCard({ bed, onClick }: { bed: BedDTO; onClick: () => void }) {
  const bg = STATUS_BG[bed.status] ?? "bg-[#f0f0f0] border-[#dedee1]";
  const dot = STATUS_DOT[bed.status] ?? "bg-[#57575f]";
  return (
    <button
      onClick={onClick}
      className={`flex flex-col gap-[6px] p-[12px] rounded-[10px] border text-left cursor-pointer hover:shadow-md hover:-translate-y-[1px] transition-all ${bg}`}
      style={{ width: 140, height: 90, flexShrink: 0 }}
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-[13px] font-medium text-[#11111c]">{bed.bedNumber}</span>
        <span className={`w-2 h-2 rounded-full ${dot}`} />
      </div>
      {bed.patientName ? (
        <>
          <span className="text-[11px] font-medium text-[#11111c] leading-[14px] whitespace-nowrap overflow-hidden text-ellipsis w-full">{bed.patientName}</span>
          <span className="text-[10px] font-light text-[#57575f]">{bed.patientId}</span>
        </>
      ) : (
        <span className={`text-[11px] font-normal leading-[14px] ${STATUS_TEXT[bed.status] ?? "text-[#57575f]"}`}>
          {bed.status}
        </span>
      )}
    </button>
  );
}

// ─── Manage bed modal ─────────────────────────────────────────────────────────

function ManageBedModal({
  bed, beds, wards, patients, onClose, onChanged, canWrite,
}: {
  bed: BedDTO;
  beds: BedDTO[];
  wards: WardDTO[];
  patients: PatientDTO[];
  onClose: () => void;
  onChanged: () => void;
  canWrite: boolean;
}) {
  const { run, loading, error, reset } = useMutation();
  const [current, setCurrent] = useState<BedDTO>(bed);
  const [assignPatientId, setAssignPatientId] = useState("");
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [edit, setEdit] = useState({ bedNumber: bed.bedNumber, ward: bed.ward });
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const freeBeds = beds.filter((b) => b.id !== current.id && b.status !== "Occupied" && b.status !== "Maintenance");

  async function assign() {
    const updated = await run(() =>
      api.post<BedDTO>(`/beds/${current.id}/assign`, { patientId: Number(assignPatientId) }),
    );
    setCurrent(updated);
    setAssignPatientId("");
    onChanged();
  }

  async function release() {
    const updated = await run(() => api.post<BedDTO>(`/beds/${current.id}/release`));
    setConfirmRelease(false);
    setCurrent(updated);
    onChanged();
  }

  async function transfer() {
    await run(() =>
      api.post<BedDTO>(`/beds/${current.id}/transfer`, {
        toBedId: Number(transferTargetId),
        reason: transferReason,
      }),
    );
    onChanged();
    onClose();
  }

  async function setStatus(status: BedStatus) {
    if (status === current.status) return;
    const updated = await run(() => api.patch<BedDTO>(`/beds/${current.id}`, { status }));
    setCurrent(updated);
    onChanged();
  }

  async function saveEdit() {
    const updated = await run(() =>
      api.patch<BedDTO>(`/beds/${current.id}`, { bedNumber: edit.bedNumber, ward: edit.ward }),
    );
    setCurrent(updated);
    onChanged();
  }

  async function remove() {
    await run(() => api.del(`/beds/${current.id}`));
    setConfirmDelete(false);
    onChanged();
    onClose();
  }

  const occupied = current.status === "Occupied";
  const sectionTitle = "text-[12px] font-medium text-[#57575f] uppercase tracking-wider";

  return (
    <>
      <Modal open onClose={onClose} title={`Bed ${current.bedNumber} — ${current.ward}`} width={560}
        footer={
          <>
            {canWrite && (
              <button
                onClick={() => { reset(); setConfirmDelete(true); }}
                className="mr-auto inline-flex items-center gap-[6px] text-[13px] font-normal text-[#ff0004] border border-[#ffc8c8] px-4 py-[8px] rounded-full hover:bg-[#ffe9e9] transition-colors"
              >
                <Trash2 size={13} /> Delete Bed
              </button>
            )}
            <button onClick={onClose} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Close</button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Status */}
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-[6px] px-[12px] py-[5px] rounded-full text-[13px] font-medium ${STATUS_CHIP[current.status]}`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[current.status]}`} />
              {current.status}
            </span>
            {!occupied && canWrite && (
              <div className="flex items-center gap-2">
                {STATUSES.filter((s) => s !== "Occupied" && s !== current.status).map((s) => (
                  <button key={s} onClick={() => setStatus(s)} disabled={loading}
                    className="text-[12px] font-normal text-[#57575f] border border-[#dedee1] px-3 py-[5px] rounded-full hover:bg-[#f6f6f6] hover:text-[#11111c] transition-colors disabled:opacity-50"
                  >
                    Mark {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {occupied ? (
            <>
              {/* Occupant */}
              <div className="bg-[#f6f6f6] rounded-[10px] p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#e8f7f7] flex items-center justify-center text-[#009598] shrink-0">
                  <UserRound size={17} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium text-[#11111c] truncate">{current.patientName}</p>
                  {current.patientId && <p className="text-[12px] font-light text-[#57575f]">{current.patientId}</p>}
                </div>
                {canWrite && (
                  <button
                    onClick={() => { reset(); setConfirmRelease(true); }}
                    disabled={loading}
                    className="inline-flex items-center gap-[6px] text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 shrink-0"
                  >
                    <LogOut size={13} /> Discharge & Free
                  </button>
                )}
              </div>

              {/* Transfer */}
              {canWrite && (
                <div className="flex flex-col gap-3">
                  <span className={sectionTitle}>Transfer to another bed</span>
                  <div className="grid grid-cols-2 gap-3">
                    <SearchSelect
                      placeholder="Select free bed"
                      value={transferTargetId}
                      onChange={setTransferTargetId}
                      options={freeBeds.map((b) => ({
                        value: String(b.id),
                        label: `${b.ward} · ${b.bedNumber}`,
                        hint: b.status,
                      }))}
                    />
                    <FormInput placeholder="Reason (optional)" value={transferReason} onChange={setTransferReason} />
                  </div>
                  <button
                    onClick={transfer}
                    disabled={loading || !transferTargetId}
                    className="self-start inline-flex items-center gap-[6px] text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50"
                  >
                    <ArrowRightLeft size={13} /> {loading ? "Transferring…" : "Transfer Patient"}
                  </button>
                </div>
              )}
            </>
          ) : (
            canWrite && (
              <>
                {/* Assign */}
                <div className="flex flex-col gap-3">
                  <span className={sectionTitle}>Assign a patient</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <SearchSelect
                        placeholder="Search patient…"
                        value={assignPatientId}
                        onChange={setAssignPatientId}
                        options={patients.map((p) => ({
                          value: String(p.id),
                          label: p.name,
                          hint: p.patientId ?? undefined,
                        }))}
                      />
                    </div>
                    <button
                      onClick={assign}
                      disabled={loading || !assignPatientId}
                      className="inline-flex items-center gap-[6px] text-[13px] font-normal text-white bg-[#009598] px-4 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50 shrink-0"
                    >
                      <UserPlus size={13} /> {loading ? "Assigning…" : "Assign Bed"}
                    </button>
                  </div>
                </div>
              </>
            )
          )}

          {/* Edit */}
          {canWrite && (
            <div className="flex flex-col gap-3 border-t border-[#f0f0f0] pt-4">
              <span className={sectionTitle}>Edit bed</span>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Bed Number"><FormInput value={edit.bedNumber} onChange={(v) => setEdit((e) => ({ ...e, bedNumber: v }))} /></FormRow>
                <FormRow label="Ward"><FormSelect value={edit.ward} onChange={(v) => setEdit((e) => ({ ...e, ward: v }))} options={wards.map((w) => ({ value: w.name, label: w.name }))} /></FormRow>
              </div>
              <button
                onClick={saveEdit}
                disabled={loading || !edit.bedNumber || (edit.bedNumber === current.bedNumber && edit.ward === current.ward)}
                className="self-start text-[13px] font-normal text-[#009598] border border-[#009598] px-4 py-[7px] rounded-full hover:bg-[#e8f7f7] transition-colors disabled:opacity-40 disabled:border-[#dedee1] disabled:text-[#57575f]"
              >
                Save Changes
              </button>
            </div>
          )}

          {error && (
            <div className="text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmRelease}
        title="Discharge & free bed"
        message={`Discharge ${current.patientName ?? "the patient"} and mark bed ${current.bedNumber} as Available? Any linked IPD admission will be discharged too.`}
        confirmLabel="Discharge"
        danger={false}
        loading={loading}
        onConfirm={release}
        onCancel={() => setConfirmRelease(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Delete bed"
        message={`Permanently remove bed ${current.bedNumber} from ${current.ward}?`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

// ─── Bed status view ──────────────────────────────────────────────────────────

function BedStatusView({
  beds, wards, onSelectBed, onAddWard, onEditWard, onDeleteWard, canWrite,
}: {
  beds: BedDTO[];
  wards: WardDTO[];
  onSelectBed: (b: BedDTO) => void;
  onAddWard: () => void;
  onEditWard: (w: WardDTO) => void;
  onDeleteWard: (w: WardDTO) => void;
  canWrite: boolean;
}) {
  const [activeWard, setActiveWard] = useState("All");
  const wardNames = wards.map((w) => w.name);
  const shownWards = activeWard === "All" ? wardNames : wardNames.filter((w) => w === activeWard);

  return (
    <div className="p-5 flex flex-col gap-5">
      {/* Ward filter + add ward */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="bg-[#f6f6f6] inline-flex items-center gap-[10px] p-[3px] rounded-full flex-wrap">
          {["All", ...wardNames].map((w) => (
            <button key={w} onClick={() => setActiveWard(w)}
              className={`px-4 py-[5px] rounded-full text-[13px] leading-[18px] font-normal transition-colors cursor-pointer whitespace-nowrap ${activeWard === w ? "bg-[#009598] text-white" : "text-[#57575f] hover:text-[#11111c]"}`}>
              {w}
            </button>
          ))}
        </div>
        {canWrite && (
          <button onClick={onAddWard}
            className="inline-flex items-center gap-[6px] text-[13px] font-normal text-[#009598] border border-[#009598] px-4 py-[6px] rounded-full hover:bg-[#e8f7f7] transition-colors">
            <Plus size={14} /> Add Ward
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5">
        {STATUSES.map((s) => (
          <div key={s} className="flex items-center gap-[6px]">
            <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className="text-[12px] font-normal text-[#57575f]">{s}</span>
          </div>
        ))}
      </div>

      {/* Ward grids */}
      <div className="flex flex-col gap-6">
        {shownWards.map((wardName) => {
          const ward = wards.find((w) => w.name === wardName)!;
          const wardBeds = beds.filter((b) => b.ward === wardName);
          return (
            <div key={wardName} className="border border-[#dedee1] rounded-[10px] p-5">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 group">
                  <h2 className="text-[16px] font-medium text-[#11111c] leading-5">{wardName}</h2>
                  {canWrite && (
                    <>
                      <button onClick={() => onEditWard(ward)} title="Rename ward"
                        className="text-[#c8c8cc] hover:text-[#009598] transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => onDeleteWard(ward)} title="Delete ward"
                        className="text-[#c8c8cc] hover:text-[#ff0004] transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
                <span className="text-[12px] font-light text-[#57575f]">
                  {wardBeds.length} beds · {wardBeds.filter((b) => b.status === "Occupied").length} occupied · {wardBeds.filter((b) => b.status === "Available").length} available
                </span>
              </div>
              <div className="flex flex-wrap gap-3">
                {wardBeds.map((b) => <BedCard key={b.id} bed={b} onClick={() => onSelectBed(b)} />)}
                {wardBeds.length === 0 && (
                  <span className="text-[13px] font-light text-[#c8c8cc] py-4">No beds in this ward yet — use “Add Bed” to create one.</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Transfers ────────────────────────────────────────────────────────────────

const TRANSFER_CLR: Record<string, string> = {
  Completed: "bg-[#dffff3] text-[#00955c]",
  Pending:   "bg-[#fff2e0] text-[#ff9000]",
};

function TransfersView({ transfers }: { transfers: BedTransferDTO[] }) {
  return (
    <div className="overflow-x-auto" style={{ minHeight: 555 }}>
      <div style={{ minWidth: 1100 }}>
        <div className="relative h-10 bg-[#f2f3f3]" style={{ minWidth: 1100 }}>
          {[{ l: "Patient", x: 20 }, { l: "From", x: 220 }, { l: "To", x: 460 }, { l: "Date", x: 700 }, { l: "Reason", x: 860 }, { l: "Status", x: 1040 }].map(c => (
            <span key={c.l} className="absolute top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: c.x }}>{c.l}</span>
          ))}
        </div>
        {transfers.map(t => (
          <div key={t.id} className="relative flex items-center h-[64px] border-b border-[#dedee1] last:border-0 bg-white hover:bg-[#fafafa] transition-colors" style={{ minWidth: 1100 }}>
            <span className="absolute text-[14px] font-medium text-[#11111c] whitespace-nowrap" style={{ left: 20 }}>{t.patientName}</span>
            <div className="absolute flex items-center gap-2" style={{ left: 220 }}>
              <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{t.from}</span>
              <ArrowRight size={14} className="text-[#57575f] shrink-0" />
              <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{t.to}</span>
            </div>
            <span className="absolute text-[14px] font-normal text-[#11111c] whitespace-nowrap" style={{ left: 700 }}>{formatDate(t.date)}</span>
            <span className="absolute text-[13px] font-normal text-[#57575f] whitespace-nowrap" style={{ left: 860 }}>{t.reason}</span>
            <span className={`absolute inline-flex items-center px-[10px] py-[4px] rounded-full text-[12px] font-normal whitespace-nowrap ${TRANSFER_CLR[t.status] ?? "bg-[#f0f0f0] text-[#57575f]"}`} style={{ left: 1040 }}>{t.status}</span>
          </div>
        ))}
        {transfers.length === 0 && (
          <div className="text-[13px] font-light text-[#57575f] text-center py-10">No transfers recorded yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BedsPage() {
  const { can } = useAuth();
  const canWrite = can("beds", "write");
  const [tab, setTab] = useState("status");
  const { items: beds, reload: reloadBeds } = useList<BedDTO>("/beds", { all: true });
  const { items: wards, reload: reloadWards } = useList<WardDTO>("/wards");
  const { items: transfers, reload: reloadTransfers } = useList<BedTransferDTO>("/beds/transfers");
  const { items: patients } = useList<PatientDTO>("/patients", { all: true });
  const { run, loading, error, reset } = useMutation();

  const [showAddBed, setShowAddBed] = useState(false);
  const [showWardModal, setShowWardModal] = useState(false);
  const [editingWard, setEditingWard] = useState<WardDTO | null>(null);
  const [deletingWard, setDeletingWard] = useState<WardDTO | null>(null);
  const [managedBed, setManagedBed] = useState<BedDTO | null>(null);

  const [bedForm, setBedForm] = useState({ bedNumber: "", ward: "", status: "Available" });
  const [wardForm, setWardForm] = useState({ name: "", capacity: "" });

  function reloadAll() {
    reloadBeds();
    reloadWards();
    reloadTransfers();
  }

  async function addBed() {
    await run(() => api.post("/beds", bedForm));
    setBedForm({ bedNumber: "", ward: "", status: "Available" });
    setShowAddBed(false);
    reloadBeds();
  }

  async function saveWard() {
    const body = {
      name: wardForm.name,
      capacity: wardForm.capacity ? Number(wardForm.capacity) : 0,
    };
    await run(() =>
      editingWard ? api.patch(`/wards/${editingWard.id}`, body) : api.post("/wards", body),
    );
    setShowWardModal(false);
    setEditingWard(null);
    setWardForm({ name: "", capacity: "" });
    reloadAll();
  }

  async function removeWard() {
    if (!deletingWard) return;
    await run(() => api.del(`/wards/${deletingWard.id}`));
    setDeletingWard(null);
    reloadWards();
  }

  function openAddWard() {
    reset();
    setEditingWard(null);
    setWardForm({ name: "", capacity: "" });
    setShowWardModal(true);
  }

  function openEditWard(w: WardDTO) {
    reset();
    setEditingWard(w);
    setWardForm({ name: w.name, capacity: String(w.capacity || "") });
    setShowWardModal(true);
  }

  const TABS = [
    { id: "status",    label: "Bed Status", count: beds.length },
    { id: "transfers", label: "Transfers",  count: transfers.length },
  ];

  const totalOccupied  = beds.filter(b => b.status === "Occupied").length;
  const totalAvailable = beds.filter(b => b.status === "Available").length;

  return (
    <>
      {/* Add bed */}
      <Modal open={showAddBed} onClose={() => setShowAddBed(false)} title="Add Bed"
        footer={
          <>
            <button onClick={() => setShowAddBed(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={addBed} disabled={loading || !bedForm.bedNumber || !bedForm.ward}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Adding…" : "Add Bed"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Bed Number *"><FormInput placeholder="e.g. G-11" value={bedForm.bedNumber} onChange={v => setBedForm(f => ({ ...f, bedNumber: v }))} /></FormRow>
          <FormRow label="Ward *"><FormSelect placeholder="Select ward" value={bedForm.ward} onChange={v => setBedForm(f => ({ ...f, ward: v }))} options={wards.map(w => ({ value: w.name, label: w.name }))} /></FormRow>
          <FormRow label="Status"><FormSelect placeholder="Status" value={bedForm.status} onChange={v => setBedForm(f => ({ ...f, status: v }))} options={["Available","Reserved","Maintenance"].map(s => ({ value: s, label: s }))} /></FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      {/* Add / rename ward */}
      <Modal open={showWardModal} onClose={() => setShowWardModal(false)} title={editingWard ? `Edit ${editingWard.name}` : "Add Ward"} width={460}
        footer={
          <>
            <button onClick={() => setShowWardModal(false)} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
            <button onClick={saveWard} disabled={loading || !wardForm.name.trim()}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Saving…" : editingWard ? "Save Ward" : "Add Ward"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Ward Name *"><FormInput placeholder="e.g. Pediatrics Ward" value={wardForm.name} onChange={v => setWardForm(f => ({ ...f, name: v }))} /></FormRow>
          <FormRow label="Capacity"><FormInput type="number" placeholder="e.g. 12" value={wardForm.capacity} onChange={v => setWardForm(f => ({ ...f, capacity: v }))} /></FormRow>
          {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
        </div>
      </Modal>

      {/* Delete ward */}
      <ConfirmDialog
        open={Boolean(deletingWard)}
        title="Delete ward"
        message={error?.message ?? `Delete ${deletingWard?.name}? Wards can only be deleted once they have no beds.`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={removeWard}
        onCancel={() => setDeletingWard(null)}
      />

      {/* Manage bed */}
      {managedBed && (
        <ManageBedModal
          key={managedBed.id}
          bed={managedBed}
          beds={beds}
          wards={wards}
          patients={patients}
          onClose={() => setManagedBed(null)}
          onChanged={reloadAll}
          canWrite={canWrite}
        />
      )}

      <PageHeader
        title="Beds & Wards"
        subtitle="Monitor bed availability, patient assignments, and maintenance status across all wards."
        stats={[
          { icon: UserRound,  value: String(totalOccupied),  label: "Occupied" },
          { icon: BedSingle,  value: String(totalAvailable), label: "Available" },
        ]}
        action={canWrite ? { label: "Add Bed", icon: Plus, onClick: () => { reset(); setShowAddBed(true); } } : undefined}
        dateRange={false}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />
          {tab === "status" && (
            <BedStatusView
              beds={beds}
              wards={wards}
              onSelectBed={(b) => setManagedBed(b)}
              onAddWard={openAddWard}
              onEditWard={openEditWard}
              onDeleteWard={(w) => { reset(); setDeletingWard(w); }}
              canWrite={canWrite}
            />
          )}
          {tab === "transfers" && <TransfersView transfers={transfers} />}
        </div>
      </div>
    </>
  );
}
