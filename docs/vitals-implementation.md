# Vitals capture — portable implementation guide

How Samvaad HMS captures patient vitals (blood pressure, pulse, temperature,
SpO₂) during OPD check-in. This is a clean, self-contained pattern: five
nullable numeric readings plus one derived boolean, validated with sanity
bounds (not clinical correctness), captured once per visit and displayed as
a compact formatted string.

Vitals live on the **OPD visit** record, not the patient — it's point-in-time
data tied to a single encounter, not a patient-level field.

## Where it lives in this codebase

| Piece | File |
|---|---|
| Type definition | `src/types/index.ts` (`Vitals` interface) |
| DB columns | `server/src/db/tables.ts` (`OpdVisitRow`) |
| Validation + derivation logic | `server/src/services/opd-service.ts` |
| DB row → DTO mapping | `server/src/repositories/mappers.ts` (`toOpdDTO`) |
| Form UI + display formatter | `src/app/(dashboard)/opd/page.tsx` |
| Read-only consumers (badge only) | `src/app/(dashboard)/appointments/page.tsx`, `src/app/(dashboard)/doctors/dashboard/page.tsx`, `src/components/panels/NursePanel.tsx` |

OPD check-in is the **single point of entry** for vitals — every other screen
just reads `vitalsRecorded` / `vitals` to render a badge. Worth preserving
that if you port this: let one flow own the write, and everything else stay
read-only.

## 1. Type definition

```ts
export interface Vitals {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  temperature: number | null;
  spo2: number | null;
}

// on the parent record:
vitalsRecorded: boolean;
vitals: Vitals;
```

## 2. DB columns

Flat columns on the visit/encounter table, not a nested/JSON blob — keeps
them queryable and simple to validate:

```ts
bp_systolic: number | null;
bp_diastolic: number | null;
pulse: number | null;
temperature: number | null;
spo2: number | null;
vitals_recorded: boolean;
```

## 3. Validation schema + "recorded" derivation

This is the reusable core:

```ts
/** Clinical vitals, shared by check-in and update. Ranges are sanity bounds. */
const vitalsSchema = {
  bpSystolic: { type: "number", required: false, min: 40, max: 300 },
  bpDiastolic: { type: "number", required: false, min: 20, max: 200 },
  pulse: { type: "number", required: false, min: 20, max: 250 },
  temperature: { type: "number", required: false, min: 90, max: 110 },
  spo2: { type: "number", required: false, min: 50, max: 100 },
} as const;

// spread into both create and update schemas:
const createSchema = { ...otherFields, ...vitalsSchema } as const;
const updateSchema = { ...otherFields, ...vitalsSchema } as const;

/** True when at least one vitals reading was supplied. */
function hasAnyVital(d: Record<string, unknown>): boolean {
  return ["bpSystolic", "bpDiastolic", "pulse", "temperature", "spo2"].some(
    (k) => d[k] !== undefined && d[k] !== null,
  );
}
```

The key design decision: **`vitalsRecorded` is never required from the
client** — it's derived server-side.

On create:
```ts
vitals_recorded: (data.vitalsRecorded ?? false) || hasAnyVital(data),
```

On update, entering any single reading implicitly flips the flag even if the
caller didn't explicitly set it:
```ts
if (hasAnyVital(data) && !("vitalsRecorded" in data)) patch.vitals_recorded = true;
```

This means a nurse can fill in just one field (say, temperature) and the
record correctly shows "Recorded" — you never get a half-filled-in state
that still reads as "Pending."

## 4. Mapper (DB row → DTO)

```ts
vitals: {
  bpSystolic: r.bp_systolic ?? null,
  bpDiastolic: r.bp_diastolic ?? null,
  pulse: r.pulse ?? null,
  temperature: r.temperature ?? null,
  spo2: r.spo2 ?? null,
},
```

## 5. Display formatter

One function handles every context that needs to show vitals compactly
(table cell, tooltip):

```ts
/** Compact vitals readout, e.g. "120/80 · 74 · 98.6°F · 98%". */
function vitalsSummary(v: Vitals): string {
  const parts: string[] = [];
  if (v.bpSystolic && v.bpDiastolic) parts.push(`${v.bpSystolic}/${v.bpDiastolic}`);
  if (v.pulse) parts.push(`${v.pulse} bpm`);
  if (v.temperature) parts.push(`${v.temperature}°F`);
  if (v.spo2) parts.push(`${v.spo2}%`);
  return parts.join(" · ");
}
```

Used elsewhere as a simple two-state badge when the full summary isn't
needed:

```tsx
<span className={row.vitalsRecorded ? "bg-[#dffff3] text-[#00955c]" : "bg-[#fff2e0] text-[#ff9000]"}>
  {row.vitalsRecorded ? "Recorded" : "Pending"}
</span>
```

## 6. Form UI

Plain controlled inputs, all optional, grouped under one labeled section:

```tsx
<div className="col-span-2 border-t pt-3">
  <p className="uppercase text-[11px] font-medium">
    Vitals <span className="font-normal normal-case">— optional; entering any reading marks vitals as recorded</span>
  </p>
</div>
<FormRow label="Blood Pressure (mmHg)">
  <div className="flex items-center gap-2">
    <FormInput placeholder="120" type="number" value={form.bpSystolic} onChange={v => set("bpSystolic", v)} />
    <span>/</span>
    <FormInput placeholder="80" type="number" value={form.bpDiastolic} onChange={v => set("bpDiastolic", v)} />
  </div>
</FormRow>
<FormRow label="Pulse (bpm)">
  <FormInput placeholder="72" type="number" value={form.pulse} onChange={v => set("pulse", v)} />
</FormRow>
<FormRow label="Temperature (°F)">
  <FormInput placeholder="98.6" type="number" value={form.temperature} onChange={v => set("temperature", v)} />
</FormRow>
<FormRow label="Oxygen / SpO₂ (%)">
  <FormInput placeholder="98" type="number" value={form.spo2} onChange={v => set("spo2", v)} />
</FormRow>
```

Values are kept as strings in local form state and coerced with a small
`num()` helper (`v === "" ? undefined : Number(v)`) right before the API
call, so an empty field submits as `undefined`, not `0` or `NaN`.

## Porting this to another app — checklist

1. Add the 5 nullable numeric columns + 1 boolean to whatever
   "visit/encounter" table is the right anchor in the new app.
2. Copy `vitalsSchema` + `hasAnyVital()` verbatim — the ranges are generic
   sanity bounds, not specific to this HMS.
3. Copy `vitalsSummary()` verbatim.
4. Rebuild the form block with your own input components, keeping the
   "optional, entering any reading marks as recorded" UX contract.
5. Skip `hospital_id` / tenancy-scoping helpers if the target app isn't
   multi-tenant — that's this app's tenancy layer, unrelated to vitals
   itself.
