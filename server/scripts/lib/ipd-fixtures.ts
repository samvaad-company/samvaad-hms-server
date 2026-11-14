/**
 * Test fixtures for the IPD rules: an admission needs a signed admission consent, and a discharge needs a final IPD bill (and the
 * departments' clearance). Both are fixtures: the tests that use them are about something else.
 *
 * Call `prepareIpd(method, path, body)` at the top of a test's request helper: before an admission is posted it signs an admission
 * consent for the patient, and before a discharge it makes sure the stay has a paid IPD bill. Everything else passes through.
 */
export async function prepareIpd(method: string, path: string, body?: unknown): Promise<void> {
  if (method !== "POST") return;
  const { signatureRequestsRepo, ipdRepo, billsRepo, patientsRepo, ipdDischargeClearancesRepo } = await import("@/repositories");
  const { DEPARTMENTS } = await import("@/services/ipd-clearance-service");
  if (path === "/api/ipd") {
    const patientId = Number((body as { patientId?: unknown } | undefined)?.patientId);
    if (!Number.isInteger(patientId) || patientId <= 0) return;
    const p = await patientsRepo.getRow(patientId);
    if (!p) return;
    await signatureRequestsRepo.create({
      hospital_id: p.hospital_id, patient_id: p.id, patient_name: p.name, patient_code: p.patient_code, patient_phone: p.phone ?? "",
      template_key: "admission-consent", template_texts: {}, form_title: "Admission consent", form_body: "test fixture", language: "English", include_english: false,
      token: null, status: "Signed", sent_by: "test", sent_at: new Date().toISOString(), expires_at: null, link_sent_at: null, delivery: null, opened_at: null,
      signed_at: new Date().toISOString(), signer_name: "Self", signer_relation: "Self", signed_via: "paper", signed_language: "English", witness_name: null, signed_document_id: null,
      signature_data: null, refused_reason: null, cancelled_at: null,
    } as never);
    return;
  }
  const m = /^\/api\/ipd\/(\d+)\/discharge$/.exec(path);
  if (!m) return;
  const a = await ipdRepo.getRow(Number(m[1]));
  if (!a || !a.patient_id) return;
  const { rows } = await billsRepo.listRows({ unpaged: true, filters: [{ column: "patient_id", op: "eq", value: a.patient_id }] } as never);
  // Every department has already cleared the patient.
  const done = await ipdDischargeClearancesRepo.listRows({ unpaged: true, filters: [{ column: "admission_id", op: "eq", value: a.id }] } as never);
  for (const d of DEPARTMENTS) {
    const row = (done.rows as { id: number; department: string }[]).find((r) => r.department === d.key);
    if (row) await ipdDischargeClearancesRepo.update(row.id, { status: "Cleared" } as never);
    else await ipdDischargeClearancesRepo.create({ hospital_id: a.hospital_id, admission_id: a.id, department: d.key, status: "Cleared", amount_due: 0, note: "", round: 1, requested_by: "test", requested_at: new Date().toISOString(), responded_by: "test", responded_at: new Date().toISOString() } as never);
  }
  if ((rows as { type: string; status: string }[]).some((b) => b.type === "IPD" && b.status !== "Refunded")) return;
  await billsRepo.create({
    hospital_id: a.hospital_id, bill_number: `FIX-${a.id}`, patient_id: a.patient_id, patient_name: a.patient_name, type: "IPD", bill_date: new Date().toISOString().slice(0, 10),
    amount: 1, discount: 0, gst: 0, total: 1, status: "Paid", admission_id: a.id,
  } as never);
}
