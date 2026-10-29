"use client";

/**
 * Operation Theatre. One screen, four views of the same surgeries: the existing Table, a Day grid (theatres by
 * hours), a Week grid (theatres by days) and the Register (a date range, printable as PDF). Book, Rooms and
 * Equipment sit in the header; clicking any surgery opens it in a side panel.
 */
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, DoorOpen, Plus, Stethoscope, Wrench } from "lucide-react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { useItem, useList } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth-context";
import { useRowActions } from "@/lib/api/useRowActions";
import { useHydrated } from "@/lib/use-hydrated";
import { useSavedChoice } from "@/lib/use-saved-choice";
import { RowMenu } from "@/components/shared/RowMenu";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { usePagination } from "@/components/shared/Pagination";
import { DayView } from "@/components/ot/DayView";
import { WeekView } from "@/components/ot/WeekView";
import { RegisterView } from "@/components/ot/RegisterView";
import { BookDialog } from "@/components/ot/BookDialog";
import { BookingDrawer } from "@/components/ot/BookingDrawer";
import { RoomsDialog } from "@/components/ot/RoomsDialog";
import { EquipmentDialog } from "@/components/ot/EquipmentDialog";
import { addDays, btn, dayLabel, mondayOf, STATUS_STYLE, surgeryOf, todayLocal, type SlotRequest } from "@/components/ot/shared";
import type { OtOptionsDTO, OtRecordDTO } from "@/types/api";

const VIEWS = ["table", "day", "week", "register"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = { table: "Table", day: "Day", week: "Week", register: "Register" };

const COLUMNS = [
  { label: "Booking no.", width: "120px" },
  { label: "Patient", width: "minmax(150px,1.3fr)" },
  { label: "Surgery", width: "minmax(170px,1.6fr)" },
  { label: "OT room", width: "120px" },
  { label: "Surgeon", width: "minmax(140px,1.2fr)" },
  { label: "Anaesthetist", width: "minmax(130px,1.1fr)" },
  { label: "Date", width: "110px" },
  { label: "Time", width: "80px" },
  { label: "Status", width: "120px" },
  { label: "", width: "40px", align: "right" as const },
];
const FILTERS = [
  { id: "All", label: "All" }, { id: "Scheduled", label: "Scheduled" }, { id: "InProgress", label: "In Progress" },
  { id: "Completed", label: "Completed" }, { id: "Cancelled", label: "Cancelled" },
];
const FILTER_MAP: Record<string, string> = { InProgress: "In Progress" };

function OtPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { can } = useAuth();
  const hydrated = useHydrated();
  const canWrite = can("ot", "write");

  const { items: bookings, reload } = useList<OtRecordDTO>("/ot", { all: true });
  const { item: options } = useItem<OtOptionsDTO>("/ot/options");
  const { dialog, remove } = useRowActions("ot", reload);

  const [view, setView] = useSavedChoice<View>("samvaad.ot.view", VIEWS, "table");
  const [date, setDate] = useState(todayLocal());
  const [filter, setFilter] = useState("All");
  const [q, setQ] = useState("");

  const [bookOpen, setBookOpen] = useState(search.get("book") === "1");
  const [bookKey, setBookKey] = useState(0);
  const [slot, setSlot] = useState<SlotRequest | null>(null);
  const [editing, setEditing] = useState<OtRecordDTO | null>(null);
  const [openId, setOpenId] = useState<number | null>(Number(search.get("open")) || null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [equipOpen, setEquipOpen] = useState(false);

  function openBook(s: SlotRequest | null = null, edit: OtRecordDTO | null = null) {
    setSlot(s); setEditing(edit); setBookKey((k) => k + 1); setBookOpen(true);
  }

  const rooms = options?.rooms ?? [];
  const monday = mondayOf(date);

  const needle = q.trim().toLowerCase();
  const visible = bookings
    .filter((b) => filter === "All" || b.status === (FILTER_MAP[filter] ?? filter))
    .filter((b) => !needle || [b.patientName, surgeryOf(b), b.surgeon, b.otRoom, b.bookingNo].some((v) => (v ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => b.scheduledDate.localeCompare(a.scheduledDate) || (a.startMinute ?? 0) - (b.startMinute ?? 0));
  const { rows: paged, bar } = usePagination(visible, "surgeries");

  const step = view === "week" ? 7 : 1;
  const heading = view === "week" ? `${dayLabel(monday)} - ${dayLabel(addDays(monday, 6))}` : dayLabel(date);

  return (
    <>
      {dialog}
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 360 }}>
          <div className="flex items-center gap-3 flex-wrap border-b border-[color:var(--line)] px-5 py-4">
            <Stethoscope size={18} className="text-[color:var(--ink-soft)]" />
            <h1 className="text-[17px] font-semibold text-[color:var(--ink)]">Operation Theatre</h1>
            <div className="ml-auto flex items-center gap-2">
              <button onClick={() => setEquipOpen(true)} className={`${btn.base} ${btn.ghost}`}><Wrench size={14} /> Equipment</button>
              <button onClick={() => setRoomsOpen(true)} className={`${btn.base} ${btn.ghost}`}><DoorOpen size={14} /> Rooms</button>
              {hydrated && canWrite && <button onClick={() => openBook()} className={`${btn.base} ${btn.solid}`}><Plus size={14} /> Book</button>}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap border-b border-[color:var(--line)] px-5 py-3">
            <div role="tablist" aria-label="OT view" className="inline-flex p-[3px] rounded-[10px] bg-[color:var(--subtle)]">
              {VIEWS.map((v) => (
                <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
                  className={`h-[30px] px-4 rounded-[8px] text-[14px] cursor-pointer transition-colors ${view === v ? "bg-[color:var(--surface)] text-[color:var(--ink)] font-medium shadow-sm" : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]"}`}>
                  {VIEW_LABEL[v]}
                </button>
              ))}
            </div>
            {(view === "day" || view === "week") && (
              <div className="ml-auto flex items-center gap-3">
                <button onClick={() => setDate(addDays(date, -step))} aria-label={view === "week" ? "Previous week" : "Previous day"} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer"><ChevronLeft size={16} /></button>
                <button onClick={() => setDate(todayLocal())} className={`${btn.base} ${btn.ghost} !h-[36px] font-medium`}>Today</button>
                <button onClick={() => setDate(addDays(date, step))} aria-label={view === "week" ? "Next week" : "Next day"} className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer"><ChevronRight size={16} /></button>
                <span className="font-mono text-[14px] text-[color:var(--ink-soft)] min-w-[110px] text-right">{heading}</span>
              </div>
            )}
          </div>

          {view === "table" && (
            <>
              <FilterBar filters={FILTERS} searchPlaceholder="Search by patient, surgery, surgeon or booking no..." activeFilter={filter} onFilterChange={setFilter} searchQuery={q} onSearchChange={setQ} />
              <DataTable columns={COLUMNS} minWidth={1250}>
                {visible.length === 0 ? <div className="py-14 text-center text-[14px] text-[color:var(--ink-soft)]">No surgeries found.</div> : paged.map((b) => (
                  <div key={b.id} role="link" tabIndex={0} onClick={() => setOpenId(b.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpenId(b.id); }}
                    className={`${tw.table.dataRow} cursor-pointer focus:outline-none focus-visible:bg-[color:var(--faint)]`} style={{ gridTemplateColumns: "var(--cols)" }}>
                    <span className="font-mono text-[12px] text-[color:var(--ink-soft)] truncate">{b.bookingNo}</span>
                    <span className="text-[13px] font-medium text-[color:var(--ink)] truncate">{b.patientName}</span>
                    <span className="text-[13px] text-[color:var(--ink)] truncate">{surgeryOf(b)}{b.caseType === "Emergency" && <span className="ml-2 rounded-full bg-[#ffe3e5] px-[6px] text-[10px] font-semibold text-[#b3001b]">Emergency</span>}</span>
                    <span><span className="inline-flex items-center rounded-full bg-[color:var(--subtle-3)] px-2 py-[3px] text-[11px] font-medium text-[color:var(--ink)] whitespace-nowrap">{b.otRoom}</span></span>
                    <span className="text-[13px] text-[color:var(--ink)] truncate">{b.surgeon}</span>
                    <span className="text-[13px] text-[color:var(--ink)] truncate">{b.anesthetist}</span>
                    <span className="text-[13px] text-[color:var(--ink)] whitespace-nowrap">{formatDate(b.scheduledDate)}</span>
                    <span className="font-mono text-[12px] text-[color:var(--ink-soft)] whitespace-nowrap">{b.scheduledTime}</span>
                    <span><span className={`inline-flex rounded-full px-[10px] py-[2px] text-[12px] ${STATUS_STYLE[b.status].pill}`}>{b.status}</span></span>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <RowMenu compact actions={[
                        { label: "Open details", onClick: () => setOpenId(b.id) },
                        { label: "Open full page", onClick: () => router.push(`/ot/${b.id}`) },
                        ...(canWrite ? [
                          { label: "Edit / reschedule", disabled: b.status === "Completed" || b.status === "Cancelled", onClick: () => openBook(null, b) },
                          { label: "Delete", danger: true, onClick: () => remove(b.id, surgeryOf(b)) },
                        ] : []),
                      ]} />
                    </div>
                  </div>
                ))}
              </DataTable>
              {bar}
            </>
          )}
          {view === "day" && <DayView date={date} rooms={rooms} bookings={bookings} canWrite={canWrite} onOpen={(b) => setOpenId(b.id)} onBookSlot={(s) => openBook(s)} />}
          {view === "week" && <WeekView monday={monday} rooms={rooms} bookings={bookings} canWrite={canWrite} onOpen={(b) => setOpenId(b.id)} onBookSlot={(s) => openBook(s)} onPickDay={(d) => { setDate(d); setView("day"); }} />}
          {view === "register" && <RegisterView bookings={bookings} onOpen={(b) => setOpenId(b.id)} />}
        </div>
      </div>

      <BookDialog key={bookKey} open={bookOpen} onClose={() => setBookOpen(false)} slot={slot} editing={editing}
        onSaved={(b) => { reload(); setDate(b.scheduledDate); setOpenId(b.id); }} />
      {openId != null && (
        <BookingDrawer id={openId} canWrite={canWrite} onClose={() => setOpenId(null)} onChanged={reload}
          onEdit={(b) => { setOpenId(null); openBook(null, b); }}
          onDelete={(b) => { setOpenId(null); remove(b.id, surgeryOf(b)); }} />
      )}
      <RoomsDialog open={roomsOpen} onClose={() => { setRoomsOpen(false); reload(); }} canWrite={canWrite} />
      <EquipmentDialog open={equipOpen} onClose={() => { setEquipOpen(false); reload(); }} canWrite={canWrite} />
    </>
  );
}

export default function OtPage() {
  return (
    <Suspense fallback={null}>
      <OtPageInner />
    </Suspense>
  );
}
