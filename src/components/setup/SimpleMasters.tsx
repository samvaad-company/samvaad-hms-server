"use client";

/**
 * The plain masters — a code, a name and a few extras: payer classes, patient categories, visit purposes, arrival statuses,
 * income groups, specialties, org units, ward classes, consulting rooms, facility areas, collection centres, lab
 * collection centres, drug racks — plus Departments (which live in the existing departments table).
 */
import { useState } from "react";
import { useList } from "@/lib/api/hooks";
import type { DepartmentDTO } from "@/types/api";
import { FACILITY_AREA_TYPES, ORG_UNIT_TYPES, inr, type SetupKind } from "@/types/setup";
import { Pill } from "@/components/mrd/shared";
import { AddButton, Code, Dot, EditIcon, FormDialog, Inactive, ListBox, ListHeader, Muted, Row, num, str, useSetup, type FieldSpec, type Rec } from "@/components/setup/ui";

const opt = (values: readonly string[]) => values.map((v) => ({ value: v, label: v }));
const code = (label = "Code", placeholder = "GEN"): FieldSpec => ({ key: "code", label, placeholder, mono: true, upper: true });
const name: FieldSpec = { key: "name", label: "Name" };
const active: FieldSpec = { key: "active", label: "Active", type: "toggle" };

interface Spec {
  kind: SetupKind;
  title: string;
  singular: string;
  /** The line under the dialog title. */
  blurb: string;
  rows: (lookups: Record<string, { value: string; label: string }[]>) => FieldSpec[][];
  /** Other masters this one's pickers need. */
  needs?: Record<string, SetupKind>;
  meta?: (r: Rec, lookups: Record<string, Rec[]>) => React.ReactNode;
  hasCode?: boolean;
  dot?: boolean;
}

const shared = "are shared across registration, admission and billing.";

export const SIMPLE_SPECS: Record<string, Spec> = {
  rate_plan_types: { kind: "payer_class", title: "Payer classes", singular: "payer class", blurb: `Payer classes ${shared}`, rows: () => [[code(), name], [active]] },
  patient_categories: {
    kind: "patient_category", title: "Patient categories", singular: "patient category", blurb: `Patient categories ${shared}`, dot: true,
    rows: () => [[code(), name], [{ key: "colour", label: "Colour", type: "colour" }], [{ key: "description", label: "Description", type: "textarea" }], [active]],
  },
  visit_purposes: { kind: "visit_purpose", title: "Visit purposes", singular: "visit purpose", blurb: `Visit purposes ${shared}`, rows: () => [[code(), name], [active]] },
  arrival_statuses: {
    kind: "arrival_status", title: "Arrival statuses", singular: "arrival status", blurb: `Arrival statuses ${shared}`, dot: true,
    rows: () => [[code(), name], [{ key: "colour", label: "Colour", type: "colour" }], [active]],
  },
  income_groups: {
    kind: "income_group", title: "Income groups", singular: "income group", blurb: `Income groups ${shared}`,
    rows: () => [[code(), name], [{ key: "minIncome", label: "Min annual income (₹)", type: "number" }], [{ key: "maxIncome", label: "Max annual income (₹)", type: "number", hint: "Leave empty for no upper limit." }], [active]],
    meta: (r) => <Muted>{inr(num(r.data.minIncome))} – {r.data.maxIncome == null ? "∞" : inr(num(r.data.maxIncome))}</Muted>,
  },
  specialties: { kind: "specialty", title: "Specialties", singular: "specialty", blurb: `Specialties ${shared}`, rows: () => [[code("Code", "CAR"), name], [active]] },
  org_units: {
    kind: "org_unit", title: "Org units", singular: "org unit", blurb: `Org units ${shared}`, hasCode: false,
    rows: () => [[code("Unit code", "OPD")], [name], [{ key: "type", label: "Type", type: "select", options: opt(ORG_UNIT_TYPES) }], [active]],
    meta: (r) => <Muted>{str(r.data.type)}</Muted>,
  },
  ward_classes: { kind: "ward_class", title: "Ward classes", singular: "ward class", blurb: `Ward classes ${shared}`, rows: () => [[code(), name], [{ key: "description", label: "Description", type: "textarea" }], [active]] },
  consulting_rooms: {
    kind: "consulting_room", title: "Consulting rooms", singular: "consulting room", blurb: `Consulting rooms ${shared}`, hasCode: false, needs: { facilityAreaId: "facility_area" },
    rows: (l) => [[name], [{ key: "code", label: "Room code (optional)", placeholder: "CR-01", mono: true, upper: true }], [{ key: "facilityAreaId", label: "Facility area", type: "select", options: [{ value: "", label: "None" }, ...(l.facilityAreaId ?? [])] }], [active]],
    meta: (r) => (r.code ? <Muted>{r.code}</Muted> : null),
  },
  facility_areas: {
    kind: "facility_area", title: "Facility areas", singular: "facility area", blurb: `Facility areas ${shared}`,
    rows: () => [[code("Code", "REC"), name], [{ key: "type", label: "Type", type: "select", options: opt(FACILITY_AREA_TYPES) }], [active]],
    meta: (r) => <Muted>{str(r.data.type)}</Muted>,
  },
  service_collection_centers: {
    kind: "collection_center", title: "Collection centers", singular: "collection center", blurb: `Collection centers ${shared}`, needs: { facilityAreaId: "facility_area", branchId: "branch" },
    rows: (l) => [[code(), name], [{ key: "facilityAreaId", label: "Facility area", type: "select", options: [{ value: "", label: "None" }, ...(l.facilityAreaId ?? [])] }], [{ key: "branchId", label: "Branch", type: "select", options: [{ value: "", label: "None" }, ...(l.branchId ?? [])] }], [{ key: "external", label: "External center", type: "toggle" }], [active]],
    meta: (r) => (r.data.external === true ? <Pill tone="plain">External</Pill> : null),
  },
  collection_centers: {
    kind: "lab_collection_center", title: "Lab collection centers", singular: "lab collection center", blurb: `Lab collection centers ${shared}`,
    rows: () => [[code()], [name], [{ key: "address", label: "Address" }], [{ key: "contactPerson", label: "Contact person" }], [{ key: "phone", label: "Phone" }], [{ key: "email", label: "Email" }], [active]],
    meta: (r) => (r.data.contactPerson ? <Muted>{str(r.data.contactPerson)}</Muted> : null),
  },
  drug_racks: {
    kind: "drug_rack", title: "Drug racks", singular: "drug rack", blurb: "Drug racks are shared across registration, admission and billing.",
    rows: () => [[code("Code", "R-A1")], [name], [{ key: "location", label: "Location", placeholder: "Store 1 · Shelf B" }], [active]],
    meta: (r) => <Muted>{str(r.data.location)}</Muted>,
  },
};

/** Dialog title / list-header grammar as in the reference: "Add ward class", "Edit ward class", "Ward classes 6". */
export function SimpleMasterView({ section }: { section: string }) {
  const spec = SIMPLE_SPECS[section];
  const { items, reload } = useSetup(spec.kind);
  const area = useSetup("facility_area");
  const branch = useSetup("branch");
  const [editing, setEditing] = useState<Rec | "new" | null>(null);
  const lookups: Record<string, { value: string; label: string }[]> = {
    facilityAreaId: area.items.map((a) => ({ value: String(a.id), label: a.name })),
    branchId: branch.items.map((b) => ({ value: String(b.id), label: b.name })),
  };
  const rows = spec.rows(lookups);
  const initial = editing && editing !== "new" ? { code: editing.code, name: editing.name, active: editing.active, ...editing.data, ...(spec.needs ? Object.fromEntries(Object.keys(spec.needs).map((k) => [k, editing.data[k] == null ? "" : String(editing.data[k])])) : {}) } : { active: true };
  const showCode = spec.hasCode !== false;

  return (
    <div>
      <ListHeader title={spec.title} count={items.length}><AddButton label={`Add ${spec.singular}`} onClick={() => setEditing("new")} /></ListHeader>
      <ListBox>
        {items.map((r) => (
          <Row key={r.id}>
            {spec.dot && <Dot colour={str(r.data.colour)} />}
            {showCode && r.code && <Code>{r.code}</Code>}
            <span className="min-w-0 truncate text-[14px] font-medium text-[color:var(--ink)]">{r.name}</span>
            {spec.meta?.(r, {})}
            {!r.active && <Inactive />}
            <span className="ml-auto"><EditIcon label={`Edit ${r.name}`} onClick={() => setEditing(r)} /></span>
          </Row>
        ))}
        {items.length === 0 && <p className="px-4 py-10 text-center text-[14px] text-[color:var(--ink-soft)]">Nothing here yet — add the first one.</p>}
      </ListBox>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} title={`${editing === "new" ? "Add" : "Edit"} ${spec.singular}`} subtitle={spec.blurb} rows={rows} initial={initial}
          endpoint={`/setup/${spec.kind}`} id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? `Add ${spec.singular}` : "Save changes"} deleteLabel={`Delete ${spec.singular}`}
          onClose={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}

// ── Departments (the existing table, with the Masters fields) ────────────────

export function DepartmentsView() {
  const { items, reload } = useList<DepartmentDTO>("/departments");
  const specialties = useSetup("specialty");
  const [editing, setEditing] = useState<DepartmentDTO | "new" | null>(null);
  return (
    <div>
      <ListHeader title="Departments" count={items.length}><AddButton label="Add department" onClick={() => setEditing("new")} /></ListHeader>
      <ListBox>
        {items.map((d) => (
          <Row key={d.id}>
            {d.code && <Code>{d.code}</Code>}
            <span className="min-w-0 truncate text-[14px] font-medium text-[color:var(--ink)]">{d.name}</span>
            <Muted>{d.clinical ? "Clinical" : "Non-clinical"}</Muted>
            {d.specialty && <Muted>· {d.specialty}</Muted>}
            {!d.active && <Inactive />}
            <span className="ml-auto"><EditIcon label={`Edit ${d.name}`} onClick={() => setEditing(d)} /></span>
          </Row>
        ))}
      </ListBox>
      {editing && (
        <FormDialog key={editing === "new" ? "new" : editing.id} title={editing === "new" ? "Add department" : "Edit department"} subtitle={`Departments ${shared}`}
          rows={[[code()], [name], [{ key: "specialty", label: "Specialty", type: "select", options: [{ value: "", label: "None" }, ...specialties.items.map((s) => ({ value: s.name, label: s.name }))] }], [{ key: "clinical", label: "Clinical department", type: "toggle" }], [active]]}
          initial={editing === "new" ? { clinical: true, active: true } : { code: editing.code, name: editing.name, specialty: editing.specialty, clinical: editing.clinical, active: editing.active }}
          endpoint="/departments" id={editing === "new" ? undefined : editing.id} submitLabel={editing === "new" ? "Add department" : "Save changes"}
          prepare={(v) => ({ ...v, code: v.code || undefined })} onClose={() => { setEditing(null); reload(); }} />
      )}
    </div>
  );
}
