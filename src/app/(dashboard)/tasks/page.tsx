"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import {
  ClipboardList, Plus, LayoutGrid, List as ListIcon, Trash2, Target, User, CalendarClock,
} from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth-context";
import { parseDisplayDate, formatDate } from "@/lib/dates";
import type { TaskDTO, StaffDTO } from "@/types/api";
import type { TaskStatus, TaskPriority } from "@/types";
import { PageHeader } from "@/components/shared/PageHeader";
import { Modal } from "@/components/shared/Modal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FormRow, FormInput, FormSelect, FormTextarea } from "@/components/shared/FormRow";

const STATUSES: TaskStatus[] = ["To Do", "In Progress", "Blocked", "Done"];
const PRIORITIES: TaskPriority[] = ["Low", "Medium", "High", "Urgent"];

const COLUMN_CLR: Record<TaskStatus, { dot: string; bg: string; text: string }> = {
  "To Do":       { dot: "#57575f", bg: "#f2f3f3", text: "#57575f" },
  "In Progress": { dot: "#007cff", bg: "#d6eaff", text: "#007cff" },
  "Blocked":     { dot: "#ff0004", bg: "#ffe9e9", text: "#ff0004" },
  "Done":        { dot: "#00955c", bg: "#dffff3", text: "#00955c" },
};

const PRIORITY_CLR: Record<TaskPriority, string> = {
  Urgent: "bg-[#ffe9e9] text-[#ff0004]",
  High:   "bg-[#fff2e0] text-[#ff9000]",
  Medium: "bg-[#d6eaff] text-[#007cff]",
  Low:    "bg-[#f0f0f0] text-[#57575f]",
};

function PriorityChip({ p }: { p: TaskPriority }) {
  return (
    <span className={`inline-flex px-[8px] py-[3px] rounded-full text-[11px] font-medium ${PRIORITY_CLR[p]}`}>
      {p}
    </span>
  );
}

/** "12 Nov 2025" or ISO → yyyy-mm-dd for <input type="date">. */
function toDateInputValue(s: string): string {
  // ISO dates would parse as UTC midnight and shift a day in western zones.
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (iso) return iso[1];
  const d = parseDisplayDate(s);
  if (!d) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-dd from the date input → "12 Nov 2025" to match stored dates. */
function toDisplayDateValue(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function TaskCard({
  task, onMove, onDelete, onOpen, draggable, canWrite,
}: {
  task: TaskDTO;
  onMove: (id: number, status: TaskStatus) => void;
  onDelete: (task: TaskDTO) => void;
  onOpen: (task: TaskDTO) => void;
  draggable?: boolean;
  canWrite: boolean;
}) {
  return (
    <div
      draggable={canWrite && draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(task.id))}
      onClick={() => onOpen(task)}
      className={`bg-white border border-[#dedee1] rounded-[10px] p-3 flex flex-col gap-2 cursor-pointer hover:border-[#009598] transition-colors ${canWrite ? "active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-[#11111c] leading-snug">{task.title}</span>
        {canWrite && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
            className="text-[#c8c8cc] hover:text-[#ff0004] transition-colors shrink-0"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {task.goal && (
        <span className="inline-flex items-center gap-1 text-[11px] text-[#009598]">
          <Target size={11} /> {task.goal}
        </span>
      )}
      {task.description && (
        <p className="text-[12px] font-light text-[#57575f] line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center justify-between mt-1">
        <PriorityChip p={task.priority} />
        <span className="inline-flex items-center gap-1 text-[11px] text-[#57575f]">
          <CalendarClock size={11} /> {task.dueDate}
        </span>
      </div>
      <div className="flex items-center gap-1 border-t border-[#f0f0f0] pt-2">
        <div className="w-5 h-5 rounded-full bg-[#e8f7f7] flex items-center justify-center text-[9px] font-medium text-[#009598] shrink-0">
          {task.assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
        </div>
        <span className="text-[11px] text-[#57575f] truncate flex-1">{task.assigneeName}</span>
        <select
          value={task.status}
          disabled={!canWrite}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onMove(task.id, e.target.value as TaskStatus)}
          className="text-[10px] text-[#57575f] border border-[#dedee1] rounded-[6px] px-1 py-[2px] outline-none focus:border-[#009598] bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Create when `task` is null, otherwise view/edit an existing task. */
function TaskModal({
  task, staff, canWrite, onClose, onSaved, onDelete,
}: {
  task: TaskDTO | null;
  staff: StaffDTO[];
  canWrite: boolean;
  onClose: () => void;
  onSaved: () => void;
  onDelete: (task: TaskDTO) => void;
}) {
  const { run, loading, error } = useMutation();
  const [form, setForm] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    goal: task?.goal ?? "",
    assigneeId: task?.assigneeId ? String(task.assigneeId) : "",
    priority: task?.priority ?? "Medium",
    status: task?.status ?? "To Do",
    dueDate: task ? toDateInputValue(task.dueDate) : "",
  });
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    if (!form.title.trim()) return;
    const assignee = staff.find((s) => String(s.id) === form.assigneeId);
    const body = {
      title: form.title,
      description: form.description,
      goal: form.goal,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
      assigneeName: assignee?.name,
      priority: form.priority,
      status: form.status,
      // Omit an empty due date on edit so an unparseable existing value isn't wiped.
      ...(form.dueDate || !task ? { dueDate: form.dueDate ? toDisplayDateValue(form.dueDate) : "" } : {}),
    };
    await run(() => (task ? api.patch(`/tasks/${task.id}`, body) : api.post("/tasks", body)));
    onSaved();
    onClose();
  }

  return (
    <Modal open onClose={onClose} title={task ? "Task Details" : "New Task"} width={620}
      footer={
        <>
          {task && canWrite && (
            <button
              onClick={() => onDelete(task)}
              className="mr-auto inline-flex items-center gap-[6px] text-[13px] font-normal text-[#ff0004] border border-[#ffc8c8] px-4 py-[8px] rounded-full hover:bg-[#ffe9e9] transition-colors"
            >
              <Trash2 size={13} /> Delete
            </button>
          )}
          <button onClick={onClose} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">
            {canWrite ? "Cancel" : "Close"}
          </button>
          {canWrite && (
            <button onClick={save} disabled={loading || !form.title.trim()}
              className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
              {loading ? "Saving…" : task ? "Save Changes" : "Create Task"}
            </button>
          )}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        {!canWrite && (
          <div className="col-span-2 text-[12px] font-normal text-[#57575f] bg-[#f6f6f6] rounded-[8px] px-3 py-2">
            You have read-only access to tasks.
          </div>
        )}
        <div className="col-span-2"><FormRow label="Task Title *"><FormInput placeholder="What needs to be done?" value={form.title} onChange={(v) => set("title", v)} disabled={!canWrite} /></FormRow></div>
        <div className="col-span-2"><FormRow label="Description"><FormTextarea placeholder="Details, checklist, context…" value={form.description} onChange={(v) => set("description", v)} disabled={!canWrite} /></FormRow></div>
        <FormRow label="Goal / Objective"><FormInput placeholder="e.g. OT Readiness" value={form.goal} onChange={(v) => set("goal", v)} disabled={!canWrite} /></FormRow>
        <FormRow label="Assign To *"><FormSelect placeholder="Select staff" value={form.assigneeId} onChange={(v) => set("assigneeId", v)} options={staff.map((s) => ({ value: String(s.id), label: `${s.name} — ${s.role}` }))} disabled={!canWrite} /></FormRow>
        <FormRow label="Priority"><FormSelect value={form.priority} onChange={(v) => set("priority", v)} options={PRIORITIES.map((p) => ({ value: p, label: p }))} disabled={!canWrite} /></FormRow>
        <FormRow label="Due Date"><FormInput type="date" value={form.dueDate} onChange={(v) => set("dueDate", v)} disabled={!canWrite} /></FormRow>
        {task && (
          <FormRow label="Status"><FormSelect value={form.status} onChange={(v) => set("status", v)} options={STATUSES.map((s) => ({ value: s, label: s }))} disabled={!canWrite} /></FormRow>
        )}
        {task && (
          <div className="col-span-2 text-[12px] font-light text-[#57575f] border-t border-[#f0f0f0] pt-3">
            Assigned by <span className="font-normal text-[#11111c]">{task.assignedBy || "—"}</span>
            {task.createdAt && <> · Created {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>}
          </div>
        )}
        {error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>}
      </div>
    </Modal>
  );
}

export default function TasksPage() {
  const { can } = useAuth();
  const canWrite = can("tasks", "write");
  const { items: tasks, reload } = useList<TaskDTO>("/tasks", { all: true });
  const { items: staff } = useList<StaffDTO>("/staff", { all: true });
  const { run, loading } = useMutation();

  const [view, setView] = useState<"board" | "list">("board");
  const [modal, setModal] = useState<{ open: boolean; task: TaskDTO | null }>({ open: false, task: null });
  const [deleting, setDeleting] = useState<TaskDTO | null>(null);
  const [dragOver, setDragOver] = useState<TaskStatus | null>(null);

  async function moveTask(id: number, status: TaskStatus) {
    await run(() => api.patch(`/tasks/${id}`, { status }));
    reload();
  }

  async function confirmDelete() {
    if (!deleting) return;
    await run(() => api.del(`/tasks/${deleting.id}`));
    setDeleting(null);
    setModal({ open: false, task: null });
    reload();
  }

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s);
  const openCount = tasks.filter((t) => t.status !== "Done").length;

  return (
    <>
      {modal.open && (
        <TaskModal
          key={modal.task?.id ?? "new"}
          task={modal.task}
          staff={staff}
          canWrite={canWrite}
          onClose={() => setModal({ open: false, task: null })}
          onSaved={reload}
          onDelete={(t) => setDeleting(t)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete task"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={loading}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <PageHeader
        title="Task Board"
        subtitle="Set goals and assign tasks to staff — track them from To Do to Done."
        stats={[{ icon: ClipboardList, value: `${openCount}`, label: "Open Tasks" }]}
        action={canWrite ? { label: "New Task", icon: Plus, onClick: () => setModal({ open: true, task: null }) } : undefined}
        dateRange={false}
      />

      <div className={`${tw.gutterX} mb-[30px]`}>
        {/* View toggle */}
        <div className="flex items-center gap-2 mb-4">
          {([["board", LayoutGrid, "Board"], ["list", ListIcon, "List"]] as const).map(([v, Icon, label]) => (
            <button key={v} onClick={() => setView(v)}
              className={`inline-flex items-center gap-2 text-[13px] px-4 py-2 rounded-full transition-colors ${
                view === v ? "bg-[#009598] text-white" : "text-[#57575f] border border-[#dedee1] hover:bg-[#f6f6f6]"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>

        {view === "board" ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            {STATUSES.map((status) => {
              const clr = COLUMN_CLR[status];
              const list = byStatus(status);
              return (
                <div
                  key={status}
                  onDragOver={canWrite ? (e) => { e.preventDefault(); setDragOver(status); } : undefined}
                  onDragLeave={canWrite ? () => setDragOver((s) => (s === status ? null : s)) : undefined}
                  onDrop={canWrite ? (e) => {
                    e.preventDefault();
                    const id = Number(e.dataTransfer.getData("text/task-id"));
                    setDragOver(null);
                    if (id) moveTask(id, status);
                  } : undefined}
                  className={`rounded-[12px] p-3 min-h-[400px] transition-colors ${
                    dragOver === status ? "bg-[#e8f7f7]" : "bg-[#f7f7f7]"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: clr.dot }} />
                    <span className="text-[13px] font-medium text-[#11111c]">{status}</span>
                    <span className="text-[11px] font-medium px-[7px] py-[1px] rounded-full" style={{ background: clr.bg, color: clr.text }}>
                      {list.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {list.map((t) => (
                      <TaskCard
                        key={t.id}
                        task={t}
                        onMove={moveTask}
                        onDelete={(task) => setDeleting(task)}
                        onOpen={(task) => setModal({ open: true, task })}
                        draggable
                        canWrite={canWrite}
                      />
                    ))}
                    {list.length === 0 && (
                      <div className="text-[12px] font-light text-[#c8c8cc] text-center py-6">Drop tasks here</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`}>
            <div className="grid items-center px-5 h-11 bg-[#f2f3f3] text-[11px] font-medium text-[#57575f] uppercase tracking-wider" style={{ gridTemplateColumns: "2fr 1.2fr 1.4fr 0.8fr 1fr 1fr" }}>
              <span>Task</span><span>Goal</span><span>Assignee</span><span>Priority</span><span>Due</span><span>Status</span>
            </div>
            {tasks.map((t) => (
              <div
                key={t.id}
                onClick={() => setModal({ open: true, task: t })}
                className="grid items-center px-5 h-14 border-b border-[#f0f0f0] last:border-0 hover:bg-[#fafafa] transition-colors cursor-pointer"
                style={{ gridTemplateColumns: "2fr 1.2fr 1.4fr 0.8fr 1fr 1fr" }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[13px] font-medium text-[#11111c] truncate">{t.title}</span>
                </div>
                <span className="text-[12px] text-[#57575f] truncate flex items-center gap-1">
                  {t.goal ? <><Target size={11} className="text-[#009598]" /> {t.goal}</> : "—"}
                </span>
                <span className="text-[12px] text-[#11111c] truncate flex items-center gap-1">
                  <User size={11} className="text-[#57575f]" /> {t.assigneeName}
                </span>
                <PriorityChip p={t.priority} />
                <span className="text-[12px] text-[#57575f]">{formatDate(t.dueDate)}</span>
                <select
                  value={t.status}
                  disabled={!canWrite}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => moveTask(t.id, e.target.value as TaskStatus)}
                  className="text-[12px] text-[#11111c] border border-[#dedee1] rounded-[8px] px-2 py-1 outline-none focus:border-[#009598] bg-white w-fit disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-[13px] font-light text-[#57575f] text-center py-10">No tasks yet.</div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
