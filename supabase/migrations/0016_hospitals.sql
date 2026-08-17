-- ============================================================================
-- Samvaad HMS — Multi-tenancy foundation
--
-- Turns the implicit single hospital into a real tenant: `hospital_settings`
-- (already a one-row-per-hospital settings record) becomes the `hospitals`
-- table, and every operational table gets a `hospital_id` scoping column.
-- The existing data becomes hospital id 1 so nothing currently in the
-- database changes ownership.
--
-- Line-item child tables (prescription_items, purchase_order_items,
-- pharmacy_sale_items, ipd_notes, ipd_medications) are deliberately left
-- without their own hospital_id — they're always reached through an
-- already-scoped parent row (prescription_id, purchase_order_id, ...), so a
-- second copy of the tenant column would just be one more place to keep in
-- sync.
-- ============================================================================

-- ── Hospitals (renamed from the single-row hospital_settings) ───────────────

alter table hospital_settings rename to hospitals;
alter table hospitals
  add column if not exists code   text,
  add column if not exists status text not null default 'Active';

update hospitals set code = 'HOSP-0001' where code is null;

-- ── hospital_id on every operational table ───────────────────────────────────

do $$
declare
  t text;
  tables text[] := array[
    'users', 'departments', 'doctors', 'staff', 'patients', 'appointments',
    'opd_visits', 'medicines', 'prescriptions', 'pharmacy_items', 'lab_tests',
    'bills', 'wards', 'beds', 'ipd_admissions', 'ot_schedules', 'audit_logs',
    'blood_donors', 'blood_stock', 'blood_issues', 'radiology_tests',
    'ambulances', 'ambulance_calls', 'birth_records', 'death_records',
    'tpas', 'tpa_claims', 'finance_incomes', 'finance_expenses',
    'inventory_items', 'inventory_issues', 'tasks', 'scribe_notes',
    'documents', 'staff_attendance', 'purchase_orders', 'pharmacy_sales',
    'bed_transfers', 'prescription_templates'
  ];
begin
  foreach t in array tables loop
    execute format(
      'alter table %I add column if not exists hospital_id integer references hospitals(id);',
      t
    );
    execute format('update %I set hospital_id = 1 where hospital_id is null;', t);
    execute format('alter table %I alter column hospital_id set not null;', t);
    execute format(
      'create index if not exists idx_%s_hospital on %I(hospital_id);',
      t, t
    );
  end loop;
end $$;
