"use client";

import { useState } from "react";
import { tw } from "@/lib/design-system";
import { formatDate } from "@/lib/dates";
import { Baby, Plus } from "lucide-react";
import { useList, useMutation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { useRowActions } from "@/lib/api/useRowActions";
import { RowMenu, type RowAction } from "@/components/shared/RowMenu";
import type { BirthRecordDTO, DeathRecordDTO } from "@/types/api";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/shared/FilterBar";
import { DataTable } from "@/components/shared/DataTable";
import { TabBar } from "@/components/shared/TabBar";
import { Modal } from "@/components/shared/Modal";
import { FormRow, FormInput, FormSelect } from "@/components/shared/FormRow";

const GENDER_OPTIONS = [{ value: "Male", label: "Male" }, { value: "Female", label: "Female" }];

// ─── Births Tab ───────────────────────────────────────────────────────────────

const BIRTH_COLUMNS = [
  { label: "Child",   width: "minmax(170px,1.5fr)" },
  { label: "Gender",  width: "80px" },
  { label: "Date",    width: "110px" },
  { label: "Time",    width: "90px" },
  { label: "Weight",  width: "80px", align: "right" as const },
  { label: "Mother",  width: "minmax(140px,1.3fr)" },
  { label: "Father",  width: "minmax(140px,1.3fr)" },
  { label: "Phone",   width: "140px" },
  { label: "Action",  width: "52px", align: "right" as const },
];

function BirthRow({ row, actions }: { row: BirthRecordDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.childName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.gender}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.time}</span>
      <span className="text-[13px] font-normal text-[#11111c] text-right">{row.weightKg ? `${row.weightKg} kg` : "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.motherName}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.fatherName || "—"}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.phone || "—"}</span>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Deaths Tab ───────────────────────────────────────────────────────────────

const DEATH_COLUMNS = [
  { label: "Deceased",  width: "minmax(170px,1.5fr)" },
  { label: "Gender",    width: "80px" },
  { label: "Age",       width: "60px" },
  { label: "Date",      width: "110px" },
  { label: "Time",      width: "90px" },
  { label: "Cause",     width: "minmax(160px,1.5fr)" },
  { label: "Guardian",  width: "minmax(140px,1.3fr)" },
  { label: "Phone",     width: "140px" },
  { label: "Action",    width: "52px", align: "right" as const },
];

function DeathRow({ row, actions }: { row: DeathRecordDTO; actions: RowAction[] }) {
  return (
    <div className={tw.table.dataRow} style={{ gridTemplateColumns: "var(--cols)" }}>
      <span className="text-[13px] font-medium text-[#11111c] truncate">{row.deceasedName}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.gender}</span>
      <span className="text-[13px] font-normal text-[#57575f]">{row.age || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] whitespace-nowrap">{formatDate(row.date)}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.time}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.cause || "—"}</span>
      <span className="text-[13px] font-normal text-[#11111c] truncate">{row.guardianName || "—"}</span>
      <span className="text-[13px] font-normal text-[#57575f] whitespace-nowrap">{row.phone || "—"}</span>
      <div className="flex justify-end"><RowMenu actions={actions} /></div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RecordsPage() {
  const [tab, setTab] = useState("births");
  const [birthSearch, setBirthSearch] = useState("");
  const [deathSearch, setDeathSearch] = useState("");
  const [modal, setModal] = useState<"" | "birth" | "death">("");

  const { items: births, reload: reloadBirths } = useList<BirthRecordDTO>("/records/births", { all: true });
  const { items: deaths, reload: reloadDeaths } = useList<DeathRecordDTO>("/records/deaths", { all: true });
  const birthActions = useRowActions("records/births", reloadBirths);
  const deathActions = useRowActions("records/deaths", reloadDeaths);
  const { run, loading, error, reset } = useMutation();

  const [birthForm, setBirthForm] = useState({ childName: "", gender: "", date: "", time: "", weightKg: "", motherName: "", fatherName: "", phone: "", address: "" });
  const [deathForm, setDeathForm] = useState({ deceasedName: "", gender: "", age: "", date: "", time: "", guardianName: "", cause: "", phone: "", address: "" });

  const closeModal = () => { setModal(""); reset(); };

  async function submitBirth() {
    await run(() => api.post("/records/births", {
      ...birthForm,
      weightKg: birthForm.weightKg ? Number(birthForm.weightKg) : 0,
    }));
    setBirthForm({ childName: "", gender: "", date: "", time: "", weightKg: "", motherName: "", fatherName: "", phone: "", address: "" });
    closeModal();
    reloadBirths();
  }

  async function submitDeath() {
    await run(() => api.post("/records/deaths", {
      ...deathForm,
      age: deathForm.age ? Number(deathForm.age) : 0,
    }));
    setDeathForm({ deceasedName: "", gender: "", age: "", date: "", time: "", guardianName: "", cause: "", phone: "", address: "" });
    closeModal();
    reloadDeaths();
  }

  const TABS = [
    { id: "births", label: "Birth Records", count: births.length },
    { id: "deaths", label: "Death Records", count: deaths.length },
  ];

  const visibleBirths = births.filter(b => {
    const q = birthSearch.toLowerCase();
    return !q || b.childName.toLowerCase().includes(q) || b.motherName.toLowerCase().includes(q) || b.fatherName.toLowerCase().includes(q);
  });
  const visibleDeaths = deaths.filter(d => {
    const q = deathSearch.toLowerCase();
    return !q || d.deceasedName.toLowerCase().includes(q) || d.guardianName.toLowerCase().includes(q) || d.cause.toLowerCase().includes(q);
  });

  const modalError = error && <div className="col-span-2 text-[13px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error.message}</div>;
  const modalFooter = (onSubmit: () => void, disabled: boolean) => (
    <>
      <button onClick={closeModal} className="text-[13px] font-normal text-[#57575f] border border-[#dedee1] px-5 py-[8px] rounded-full hover:bg-[#f6f6f6] transition-colors">Cancel</button>
      <button onClick={onSubmit} disabled={loading || disabled}
        className="text-[13px] font-normal text-white bg-[#009598] px-5 py-[8px] rounded-full hover:bg-[#007f82] transition-colors disabled:opacity-50">
        {loading ? "Saving…" : "Save Record"}
      </button>
    </>
  );

  return (
    <>
      {birthActions.dialog}
      {deathActions.dialog}

      <Modal open={modal === "birth"} onClose={closeModal} title="Register Birth"
        footer={modalFooter(submitBirth, !birthForm.childName || !birthForm.gender || !birthForm.motherName)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Child Name *"><FormInput placeholder="e.g. Baby of Sneha Kale" value={birthForm.childName} onChange={v => setBirthForm(f => ({ ...f, childName: v }))} /></FormRow>
          <FormRow label="Gender *"><FormSelect placeholder="Select gender" value={birthForm.gender} onChange={v => setBirthForm(f => ({ ...f, gender: v }))} options={GENDER_OPTIONS} /></FormRow>
          <FormRow label="Date of Birth" hint="Defaults to today"><FormInput placeholder="e.g. 8 Nov 2025" value={birthForm.date} onChange={v => setBirthForm(f => ({ ...f, date: v }))} /></FormRow>
          <FormRow label="Time of Birth"><FormInput placeholder="e.g. 4:32 AM" value={birthForm.time} onChange={v => setBirthForm(f => ({ ...f, time: v }))} /></FormRow>
          <FormRow label="Weight (kg)"><FormInput type="number" placeholder="e.g. 3.1" value={birthForm.weightKg} onChange={v => setBirthForm(f => ({ ...f, weightKg: v }))} /></FormRow>
          <FormRow label="Mother's Name *"><FormInput placeholder="Mother name" value={birthForm.motherName} onChange={v => setBirthForm(f => ({ ...f, motherName: v }))} /></FormRow>
          <FormRow label="Father's Name"><FormInput placeholder="Father name" value={birthForm.fatherName} onChange={v => setBirthForm(f => ({ ...f, fatherName: v }))} /></FormRow>
          <FormRow label="Phone"><FormInput placeholder="+91 ..." value={birthForm.phone} onChange={v => setBirthForm(f => ({ ...f, phone: v }))} /></FormRow>
          <FormRow label="Address"><FormInput placeholder="Address" value={birthForm.address} onChange={v => setBirthForm(f => ({ ...f, address: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <Modal open={modal === "death"} onClose={closeModal} title="Register Death"
        footer={modalFooter(submitDeath, !deathForm.deceasedName || !deathForm.gender)}>
        <div className="grid grid-cols-2 gap-4">
          <FormRow label="Deceased Name *"><FormInput placeholder="Full name" value={deathForm.deceasedName} onChange={v => setDeathForm(f => ({ ...f, deceasedName: v }))} /></FormRow>
          <FormRow label="Gender *"><FormSelect placeholder="Select gender" value={deathForm.gender} onChange={v => setDeathForm(f => ({ ...f, gender: v }))} options={GENDER_OPTIONS} /></FormRow>
          <FormRow label="Age"><FormInput type="number" placeholder="e.g. 82" value={deathForm.age} onChange={v => setDeathForm(f => ({ ...f, age: v }))} /></FormRow>
          <FormRow label="Date of Death" hint="Defaults to today"><FormInput placeholder="e.g. 8 Nov 2025" value={deathForm.date} onChange={v => setDeathForm(f => ({ ...f, date: v }))} /></FormRow>
          <FormRow label="Time of Death"><FormInput placeholder="e.g. 6:50 AM" value={deathForm.time} onChange={v => setDeathForm(f => ({ ...f, time: v }))} /></FormRow>
          <FormRow label="Cause of Death"><FormInput placeholder="e.g. Cardiac arrest" value={deathForm.cause} onChange={v => setDeathForm(f => ({ ...f, cause: v }))} /></FormRow>
          <FormRow label="Guardian / Next of Kin"><FormInput placeholder="Name" value={deathForm.guardianName} onChange={v => setDeathForm(f => ({ ...f, guardianName: v }))} /></FormRow>
          <FormRow label="Phone"><FormInput placeholder="+91 ..." value={deathForm.phone} onChange={v => setDeathForm(f => ({ ...f, phone: v }))} /></FormRow>
          <FormRow label="Address"><FormInput placeholder="Address" value={deathForm.address} onChange={v => setDeathForm(f => ({ ...f, address: v }))} /></FormRow>
          {modalError}
        </div>
      </Modal>

      <PageHeader
        title="Birth & Death Records"
        subtitle="Register and maintain the hospital's birth and death registries."
        stats={[{ icon: Baby, value: `${births.length}`, label: "Births Registered" }]}
        action={{ label: tab === "deaths" ? "Register Death" : "Register Birth", icon: Plus, onClick: () => setModal(tab === "deaths" ? "death" : "birth") }}
      />
      <div className={`${tw.gutterX} mb-[30px]`}>
        <div className={`${tw.surface.card} ${tw.radius.card} overflow-hidden`} style={{ minHeight: 655 }}>
          <TabBar tabs={TABS} activeTab={tab} onTabChange={setTab} />

          {tab === "births" && (
            <>
              <FilterBar filters={[{ id: "All", label: "All" }]} searchPlaceholder="Search by child, mother, or father..."
                activeFilter="All" onFilterChange={() => {}} searchQuery={birthSearch} onSearchChange={setBirthSearch}
                action={{ label: "Register Birth", icon: Plus, onClick: () => setModal("birth") }} />
              <DataTable columns={BIRTH_COLUMNS} minWidth={1200}>
                {visibleBirths.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No birth records.</div>
                ) : visibleBirths.map(b => (
                  <BirthRow key={b.id} row={b} actions={[
                    { label: "Delete", danger: true, onClick: () => birthActions.remove(b.id, b.childName) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}

          {tab === "deaths" && (
            <>
              <FilterBar filters={[{ id: "All", label: "All" }]} searchPlaceholder="Search by name, guardian, or cause..."
                activeFilter="All" onFilterChange={() => {}} searchQuery={deathSearch} onSearchChange={setDeathSearch}
                action={{ label: "Register Death", icon: Plus, onClick: () => setModal("death") }} />
              <DataTable columns={DEATH_COLUMNS} minWidth={1200}>
                {visibleDeaths.length === 0 ? (
                  <div className="py-16 text-center text-[14px] text-[#57575f]">No death records.</div>
                ) : visibleDeaths.map(d => (
                  <DeathRow key={d.id} row={d} actions={[
                    { label: "Delete", danger: true, onClick: () => deathActions.remove(d.id, d.deceasedName) },
                  ]} />
                ))}
              </DataTable>
            </>
          )}
        </div>
      </div>
    </>
  );
}
