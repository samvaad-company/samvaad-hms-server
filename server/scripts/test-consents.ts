/**
 * Tests for consents and the patient's papers: the form catalog in English / Hindi / Gujarati, making a consent,
 * sending a link (QR, email, WhatsApp, device) and its lifecycle, the patient signing on a phone with a drawn signature
 * in their language, signing on paper with a scanned copy, the signed copy, and uploading / editing documents in
 * folders. In-process, in-memory database.
 *
 *   npm run test:consents
 */
import assert from "node:assert/strict";

Object.assign(process.env, {
  DATABASE_DRIVER: process.env.DATABASE_DRIVER || "memory",
  SESSION_SECRET: "test-session-secret-0123456789abcdef",
  PORTAL_API_KEY: "test-portal-key-0123456789",
  LOG_LEVEL: process.env.TEST_LOG_LEVEL || "error",
});

const { createApp } = await import("@/app");
const { CONSENT_FORMS, CONSENT_LANGUAGES, RELATIONS, SIGN_STRINGS, LANGUAGE_NAME } = await import("@shared/types/consent-catalog");
const { signatureRequestsRepo } = await import("@/repositories");
const { app } = await createApp();

async function request(method: string, path: string, opts: { body?: unknown; headers?: Record<string, string>; form?: FormData } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  let body: string | FormData | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) { body = JSON.stringify(opts.body); headers["content-type"] = "application/json"; }
  const res = await app.fetch(new Request(`http://localhost${path}`, { method, headers, body }));
  const parsed = (await res.json().catch(() => null)) as { data?: any; error?: { code: string; message: string } } | null;
  return { status: res.status, data: parsed?.data, error: parsed?.error, headers: res.headers };
}
const cookies = new Map<string, string>();
async function as(email: string, method: string, path: string, body?: unknown, form?: FormData) {
  if (!cookies.has(email)) {
    const login = await request("POST", "/api/auth/login", { body: { email, password: "Samvaad@123" } });
    assert.equal(login.status, 200, `login ${email}`);
    cookies.set(email, (login.headers.get("set-cookie") ?? "").split(";")[0]);
  }
  return request(method, path, { body, form, headers: { cookie: cookies.get(email)! } });
}
const ADMIN = "kevin.carter@samvaadhospital.in";
const DOCTOR = "sophia.adams@samvaadhospital.in";
const RECEPTION = "deepak.nair@samvaadhospital.in";
const BILLING = "kavitha.krishnan@samvaadhospital.in";

const tests: { name: string; fn: () => Promise<void> }[] = [];
const test = (name: string, fn: () => Promise<void>) => tests.push({ name, fn });

let seq = 0;
const mobile = () => `98${String(30000000 + ++seq * 11)}`;
const newPatient = async (name = `Consent Patient ${++seq}`) => (await as(ADMIN, "POST", "/api/patients", { name, gender: "Female", phone: mobile() })).data;
const make = async (patientId: number, over: Record<string, unknown> = {}) => as(ADMIN, "POST", `/api/patients/${patientId}/consents`, { template: "general-consent", language: "Hindi", ...over });
const tokenOf = (link: string) => link.replace("/sign/", "");
const pub = (method: string, path: string, token: string, body?: unknown) => request(method, `/api/public/signatures${path}?token=${encodeURIComponent(token)}`, { body });
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==";
const sendLink = async (id: number, over: Record<string, unknown> = {}) => as(ADMIN, "POST", `/api/consents/${id}/link`, { delivery: "qr", validDays: 3, ...over });

// ── The catalog ──────────────────────────────────────────────────────────────

test("the catalog has every form in English, Hindi and Gujarati, and the sign page has every word in all three", async () => {
  assert.deepEqual([...CONSENT_LANGUAGES], ["English", "Hindi", "Gujarati"]);
  assert.deepEqual(Object.values(LANGUAGE_NAME), ["English", "हिन्दी", "ગુજરાતી"]);
  assert.ok(CONSENT_FORMS.length >= 8);
  assert.equal(new Set(CONSENT_FORMS.map((f) => f.key)).size, CONSENT_FORMS.length, "keys are unique");
  for (const f of CONSENT_FORMS) {
    for (const l of CONSENT_LANGUAGES) {
      assert.ok(f.title[l].trim().length > 3 && f.body[l].trim().length > 40, `${f.key} in ${l}`);
    }
    assert.match(f.title.Hindi + f.body.Hindi, /[ऀ-ॿ]/, `${f.key} Hindi is in Devanagari`);
    assert.match(f.title.Gujarati + f.body.Gujarati, /[઀-૿]/, `${f.key} Gujarati is in Gujarati script`);
    assert.doesNotMatch(f.body.Gujarati, /[ऀ-ॿ]/, `${f.key} Gujarati has no Devanagari in it`);
    assert.doesNotMatch(f.body.English, /[^\x00-\x7F’‘“”—–…]/, `${f.key} English is English`);
  }
  for (const l of CONSENT_LANGUAGES) {
    const s = SIGN_STRINGS[l];
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === "string") assert.ok(v.trim().length > 0, `${l}.${k}`);
    }
    for (const r of RELATIONS) assert.ok(s.relation[r].length > 0, `${l} relation ${r}`);
    assert.ok(s.forName("Asha").includes("Asha") && s.validUntil("27 Oct").includes("27 Oct") && s.signedLine("Asha", "27 Oct").includes("Asha"));
  }
  assert.match(SIGN_STRINGS.Gujarati.agree, /[઀-૿]/);
  assert.match(SIGN_STRINGS.Hindi.agree, /[ऀ-ॿ]/);
});

// ── Making a consent ─────────────────────────────────────────────────────────

test("a consent is made for a patient in the language chosen, with nothing sent yet", async () => {
  const p = await newPatient();
  for (const language of CONSENT_LANGUAGES) {
    const r = await make(p.id, { template: "photography-consent", language });
    assert.equal(r.status, 201, JSON.stringify(r.error));
    const def = CONSENT_FORMS.find((f) => f.key === "photography-consent")!;
    assert.deepEqual([r.data.status, r.data.stage, r.data.language, r.data.formTitle, r.data.formBody, r.data.link], ["Draft", "Not signed yet", language, def.title[language], def.body[language], null]);
    assert.equal(r.data.patientName, p.name);
    assert.equal(r.data.madeBy, "Dr. Kevin Carter");
  }
  const withEnglish = await make(p.id, { language: "Gujarati", includeEnglish: true });
  assert.equal(withEnglish.data.includeEnglish, true);
  const englishOnly = await make(p.id, { language: "English", includeEnglish: true });
  assert.equal(englishOnly.data.includeEnglish, false, "no English addendum to an English form");
  assert.equal((await make(p.id, { template: "nope" })).status, 422);
  assert.equal((await make(p.id, { language: "French" })).status, 422);
  assert.equal((await make(99999)).status, 404);
  const list = (await as(ADMIN, "GET", `/api/patients/${p.id}/consents`)).data as any[];
  assert.equal(list.length, 5);
  assert.ok(list[0].id > list[list.length - 1].id, "newest first");
  const global = await as(ADMIN, "POST", "/api/consents", { patientId: p.id, template: "general-consent", language: "English" });
  assert.equal(global.status, 201);
  assert.equal((await as(ADMIN, "POST", "/api/consents", { template: "general-consent" })).status, 400, "a patient is needed");
});

test("every form in the catalog can be made", async () => {
  const p = await newPatient();
  for (const f of CONSENT_FORMS) assert.equal((await make(p.id, { template: f.key, language: "Gujarati" })).status, 201, f.key);
});

// ── Sending a link ───────────────────────────────────────────────────────────

test("a link is made for the chosen way of sending and the number of days, and a live link isn't replaced", async () => {
  const p = await newPatient();
  const c = (await make(p.id)).data;
  for (const bad of [{ delivery: "" }, { delivery: "pigeon" }, { validDays: 2 }, { validDays: 30 }, { delivery: "email" }, { delivery: "email", email: "not-an-email" }]) {
    assert.equal((await sendLink(c.id, bad)).status, 422, JSON.stringify(bad));
  }
  assert.equal((await as(ADMIN, "GET", `/api/consents/${c.id}`)).data.status, "Draft", "nothing changed");
  const sent = await sendLink(c.id, { delivery: "whatsapp", validDays: 7, signerName: "Ravi Shah" });
  assert.equal(sent.status, 200, JSON.stringify(sent.error));
  assert.deepEqual([sent.data.status, sent.data.stage, sent.data.delivery, sent.data.signerName], ["Waiting", "Sent to phone", "whatsapp", "Ravi Shah"]);
  assert.match(sent.data.link, /^\/sign\/[A-Za-z0-9_-]{20,}$/);
  const days = (new Date(sent.data.expiresAt).getTime() - new Date(sent.data.linkSentAt).getTime()) / 86_400_000;
  assert.equal(Math.round(days), 7);
  assert.equal((await sendLink(c.id)).status, 409, "already has a live link");
  const same = (await as(ADMIN, "GET", `/api/consents/${c.id}`)).data;
  assert.equal(same.link, sent.data.link, "the live link can be shown again");

  const emailed = await sendLink((await make(p.id)).data.id, { delivery: "email", email: "ravi@example.com", validDays: 1 });
  assert.equal(emailed.data.delivery, "email");
  assert.equal(Math.round((new Date(emailed.data.expiresAt).getTime() - new Date(emailed.data.linkSentAt).getTime()) / 3_600_000), 24);
  const device = await sendLink((await make(p.id)).data.id, { delivery: "device" });
  assert.equal(device.data.delivery, "device");
  assert.equal(device.data.signerName, p.name, "the patient signs unless someone else is named");
});

test("a cancelled or expired link can be replaced by a new one; a draft has nothing to cancel", async () => {
  const p = await newPatient();
  const c = (await make(p.id)).data;
  assert.equal((await as(ADMIN, "POST", `/api/consents/${c.id}/cancel`)).status, 409, "no live link");
  const first = (await sendLink(c.id)).data;
  const cancelled = await as(ADMIN, "POST", `/api/consents/${c.id}/cancel`);
  assert.deepEqual([cancelled.data.status, cancelled.data.stage, cancelled.data.link], ["Cancelled", "Link cancelled", null]);
  assert.equal((await pub("POST", "/sign", tokenOf(first.link), { name: "Someone", agree: true, signature: PNG })).status, 409, "a cancelled link is dead");
  const second = await sendLink(c.id, { delivery: "qr" });
  assert.equal(second.status, 200, JSON.stringify(second.error));
  assert.notEqual(second.data.link, first.link, "a new link, not the old one");
  assert.equal((await pub("GET", "", tokenOf(first.link))).status, 404, "the old token is gone");
  // expire it
  await signatureRequestsRepo.update(c.id, { expires_at: new Date(Date.now() - 1000).toISOString() });
  const expired = (await as(ADMIN, "GET", `/api/consents/${c.id}`)).data;
  assert.deepEqual([expired.status, expired.stage, expired.link], ["Expired", "Link expired", null]);
  const late = await pub("POST", "/sign", tokenOf(second.data.link), { name: "Someone", agree: true, signature: PNG });
  assert.equal(late.status, 409);
  assert.match(late.error!.message, /expired/);
  assert.equal((await as(ADMIN, "POST", `/api/consents/${c.id}/cancel`)).status, 409, "an expired link can't be cancelled");
  assert.equal((await sendLink(c.id)).status, 200, "but it can be replaced");
});

// ── The patient signs on a phone ─────────────────────────────────────────────

test("the patient opens the link with no login: the form comes in all three languages, and the first opening is recorded", async () => {
  const p = await newPatient("Agneya Trivedi");
  const c = (await make(p.id, { template: "photography-consent", language: "Gujarati", includeEnglish: true })).data;
  const sent = (await sendLink(c.id)).data;
  const token = tokenOf(sent.link);
  assert.equal((await as(ADMIN, "GET", `/api/consents/${c.id}`)).data.stage, "Sent to phone");
  const form = await pub("GET", "", token);
  assert.equal(form.status, 200, "no login needed");
  assert.deepEqual([form.data.patientName, form.data.language, form.data.status, form.data.includeEnglish, form.data.hospitalName.length > 0], ["Agneya Trivedi", "Gujarati", "Waiting", true, true]);
  assert.deepEqual(Object.keys(form.data.texts).sort(), ["English", "Gujarati", "Hindi"]);
  const def = CONSENT_FORMS.find((f) => f.key === "photography-consent")!;
  assert.equal(form.data.texts.Gujarati.body, def.body.Gujarati);
  assert.equal(form.data.texts.Hindi.title, def.title.Hindi);
  assert.ok(!JSON.stringify(form.data).includes(token), "the token isn't echoed back");
  const opened = (await as(ADMIN, "GET", `/api/consents/${c.id}`)).data;
  assert.equal(opened.stage, "Opened on phone");
  assert.ok(opened.openedAt);
  await pub("GET", "", token);
  assert.equal((await as(ADMIN, "GET", `/api/consents/${c.id}`)).data.openedAt, opened.openedAt, "only the first opening is recorded");
  assert.equal((await pub("GET", "", "x".repeat(32))).status, 404);
  assert.equal((await pub("GET", "", "short")).status, 404);
  assert.equal((await request("GET", "/api/public/signatures")).status, 404, "no token at all");
});

test("signing needs a name, a relation from the list, the agree box and a drawn signature; it can be done once", async () => {
  const p = await newPatient("Meena Joshi");
  const c = (await make(p.id, { language: "Gujarati" })).data;
  const token = tokenOf((await sendLink(c.id)).data.link);
  const ok = { name: "Meena Joshi", relation: "Self", agree: true, signature: PNG, language: "Gujarati" };
  const bad: [string, Record<string, unknown>][] = [
    ["no name", { name: "" }], ["one letter", { name: "M" }], ["not agreed", { agree: false }], ["agree missing", { agree: undefined }],
    ["relation not on the list", { relation: "Neighbour" }], ["no signature", { signature: undefined }], ["blank signature", { signature: "" }],
    ["not an image", { signature: "javascript:alert(1)" }], ["a jpeg", { signature: "data:image/jpeg;base64,AAAA" }], ["too big", { signature: `data:image/png;base64,${"A".repeat(310_000)}` }],
    ["language not offered", { language: "French" }],
  ];
  for (const [why, over] of bad) assert.equal((await pub("POST", "/sign", token, { ...ok, ...over })).status, 422, why);
  assert.equal((await as(ADMIN, "GET", `/api/consents/${c.id}`)).data.status, "Waiting", "nothing was signed");

  const signed = await pub("POST", "/sign", token, { ...ok, relation: "Spouse", name: "Ketan Joshi" });
  assert.equal(signed.status, 200, JSON.stringify(signed.error));
  const after = (await as(ADMIN, "GET", `/api/consents/${c.id}`)).data;
  assert.deepEqual([after.status, after.stage, after.signerName, after.signerRelation, after.signedVia, after.link], ["Signed", "Signed on phone", "Ketan Joshi", "Spouse", "phone", null]);
  assert.ok(after.signedAt);
  assert.equal((await pub("POST", "/sign", token, ok)).status, 409, "once only");
  assert.equal((await pub("POST", "/refuse", token, { reason: "changed mind" })).status, 409, "a signed form can't be declined");
  assert.equal((await as(ADMIN, "POST", `/api/consents/${c.id}/cancel`)).status, 409);
  assert.equal((await sendLink(c.id)).status, 409, "a signed form can't be sent again");
  assert.equal((await as(ADMIN, "DELETE", `/api/consents/${c.id}`)).status, 409, "or deleted");
  const row = (await signatureRequestsRepo.getRow(c.id)) as any;
  assert.equal(row.signed_language, "Gujarati");
});

test("the signed copy has the hospital, the patient, the text in each language, who signed and the signature", async () => {
  const p = await newPatient("Copy Patient");
  const c = (await make(p.id, { template: "surgery-consent", language: "Hindi", includeEnglish: true })).data;
  const blank = (await as(ADMIN, "GET", `/api/consents/${c.id}/document`)).data;
  assert.deepEqual([blank.signatureData, blank.signedAt, blank.status, blank.patient.name, blank.language, blank.includeEnglish], [null, null, "Draft", "Copy Patient", "Hindi", true], "the blank form to print");
  assert.ok(blank.hospital.name.length > 0 && blank.hospital.address.length > 0);
  const token = tokenOf((await sendLink(c.id)).data.link);
  assert.equal((await pub("GET", "/copy", token)).status, 409, "no copy before it is signed");
  await pub("POST", "/sign", token, { name: "Copy Patient", relation: "Self", agree: true, signature: PNG, language: "Hindi" });
  const copy = (await as(ADMIN, "GET", `/api/consents/${c.id}/document`)).data;
  assert.deepEqual([copy.status, copy.signerName, copy.signerRelation, copy.signedVia, copy.signatureData, copy.signedLanguage], ["Signed", "Copy Patient", "Self", "phone", PNG, "Hindi"]);
  assert.deepEqual(Object.keys(copy.texts).sort(), ["English", "Gujarati", "Hindi"]);
  assert.equal(typeof copy.patient.age, "number");
  const theirs = await pub("GET", "/copy", token);
  assert.equal(theirs.status, 200, "the patient can fetch their own copy");
  assert.equal(theirs.data.signatureData, PNG);
  const list = (await as(ADMIN, "GET", "/api/consents?status=signed")).data.items.find((r: any) => r.id === c.id);
  assert.ok(list && !("signatureData" in list) && !JSON.stringify(list).includes("iVBOR"), "the drawn image isn't in lists");
});

test("a patient can decline; a declined form can't then be signed or re-sent", async () => {
  const p = await newPatient();
  const c = (await make(p.id)).data;
  const token = tokenOf((await sendLink(c.id)).data.link);
  const r = await pub("POST", "/refuse", token, { reason: "Wants to talk to family first" });
  assert.equal(r.status, 200);
  const after = (await as(ADMIN, "GET", `/api/consents/${c.id}`)).data;
  assert.deepEqual([after.status, after.stage, after.refusedReason], ["Refused", "Declined", "Wants to talk to family first"]);
  assert.equal((await pub("POST", "/sign", token, { name: "Someone", agree: true, signature: PNG })).status, 409);
  assert.equal((await sendLink(c.id)).status, 409);
  assert.equal((await pub("GET", "", token)).data.status, "Refused");
});

// ── Signed on paper ──────────────────────────────────────────────────────────

const paper = (id: number, fields: Record<string, string>, file?: File) => {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (file) form.set("file", file);
  return as(ADMIN, "POST", `/api/consents/${id}/paper`, undefined, form);
};

test("signing on paper records who signed and the witness, and files the scanned copy in Consent & Undertakings", async () => {
  const p = await newPatient("Paper Patient");
  const c = (await make(p.id, { template: "admission-consent", language: "Gujarati" })).data;
  assert.equal((await paper(c.id, { name: "" })).status, 422);
  assert.equal((await paper(c.id, { name: "Paper Patient", relation: "Neighbour" })).status, 422);
  assert.equal((await paper(c.id, { name: "Paper Patient", signedOn: "2999-01-01" })).status, 422, "not in the future");
  assert.equal((await as(ADMIN, "GET", `/api/consents/${c.id}`)).data.status, "Draft");

  const scan = new File([new Uint8Array([137, 80, 78, 71])], "signed-form.png", { type: "image/png" });
  const r = await paper(c.id, { name: "Paper Patient", relation: "Self", witness: "Deepak Nair" }, scan);
  assert.equal(r.status, 200, JSON.stringify(r.error));
  assert.deepEqual([r.data.status, r.data.stage, r.data.signedVia, r.data.signerName, r.data.witnessName], ["Signed", "Signed on paper", "paper", "Paper Patient", "Deepak Nair"]);
  assert.ok(r.data.signedDocumentId, "the scan is filed");
  const docs = (await as(ADMIN, "GET", `/api/documents?all=true&owner_type=patient`)).data as any[];
  const doc = docs.find((d) => d.id === r.data.signedDocumentId);
  assert.ok(doc);
  assert.deepEqual([doc.ownerId, doc.folderName, doc.category, doc.title], [p.id, "Consent & Undertakings", "Consent & Undertakings", `${c.formTitle} — signed on paper`]);
  assert.equal((await paper(c.id, { name: "Paper Patient" })).status, 409, "already signed");
  assert.equal((await sendLink(c.id)).status, 409);
  const copy = (await as(ADMIN, "GET", `/api/consents/${c.id}/document`)).data;
  assert.deepEqual([copy.signedVia, copy.witnessName, copy.signatureData], ["paper", "Deepak Nair", null]);

  // without a scan, and over a live link (which stops working)
  const d = (await make(p.id)).data;
  const link = (await sendLink(d.id)).data.link;
  const noScan = await paper(d.id, { name: "Paper Patient" });
  assert.equal(noScan.status, 200);
  assert.equal(noScan.data.signedDocumentId, null);
  assert.equal((await pub("POST", "/sign", tokenOf(link), { name: "Paper Patient", agree: true, signature: PNG })).status, 409, "the phone link can't also sign it");
});

// ── Lists, counts, deleting ──────────────────────────────────────────────────

test("the list counts each state; a form that was only made can be deleted, one in progress can't", async () => {
  const p = await newPatient("Counting Patient");
  const before = (await as(ADMIN, "GET", "/api/consents")).data.counts;
  const a = (await make(p.id)).data;
  const b = (await make(p.id)).data;
  const c = (await make(p.id)).data;
  await sendLink(b.id);
  await sendLink(c.id);
  await as(ADMIN, "POST", `/api/consents/${c.id}/cancel`);
  const after = (await as(ADMIN, "GET", "/api/consents")).data.counts;
  assert.deepEqual(
    [after.draft - before.draft, after.waiting - before.waiting, after.expiredOrCancelled - before.expiredOrCancelled, after.all - before.all],
    [1, 1, 1, 3],
  );
  const drafts = (await as(ADMIN, "GET", "/api/consents?status=draft")).data.items;
  assert.ok(drafts.every((r: any) => r.status === "Draft") && drafts.some((r: any) => r.id === a.id));
  const ended = (await as(ADMIN, "GET", "/api/consents?status=ended")).data.items.map((r: any) => r.status);
  assert.ok(ended.length > 0 && ended.every((s: string) => s === "Cancelled" || s === "Expired"));
  const search = (await as(ADMIN, "GET", `/api/consents?q=${encodeURIComponent("Counting Patient")}`)).data.items;
  assert.equal(search.length, 3);
  assert.equal((await as(ADMIN, "DELETE", `/api/consents/${a.id}`)).status, 204);
  assert.equal((await as(ADMIN, "GET", `/api/consents/${a.id}`)).status, 404);
  assert.equal((await as(ADMIN, "DELETE", `/api/consents/${b.id}`)).status, 409, "it has a live link");
});

// ── Uploading papers ─────────────────────────────────────────────────────────

const upload = (email: string, fields: Record<string, string>, file = new File([new Uint8Array([37, 80, 68, 70])], "case-paper.pdf", { type: "application/pdf" })) => {
  const form = new FormData();
  form.set("file", file);
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return as(email, "POST", "/api/documents", undefined, form);
};

test("papers are uploaded into one of the standard folders with a title and reference number, found by search, edited and removed", async () => {
  const p = await newPatient();
  const folders = (await as(ADMIN, "GET", "/api/documents/folders")).data as any[];
  const names = folders.map((f) => f.name);
  for (const n of ["Registration", "OPD Records", "IPD Records", "Lab Reports", "Radiology Reports", "Consent & Undertakings", "KYC Documents", "Discharge Summaries", "Referral Letters", "Insurance Documents", "Legal / MLC", "Other", "Health Camp Records", "External Reports"]) assert.ok(names.includes(n), n);
  assert.equal(new Set(names).size, names.length, "no folder twice, even after asking again");
  const legal = folders.find((f) => f.name === "Legal / MLC");

  const up = await upload(ADMIN, { ownerType: "patient", ownerId: String(p.id), folderId: String(legal.id), title: "Fitness certificate", referenceNo: "CERT/2026/0009" });
  assert.equal(up.status, 201, JSON.stringify(up.error));
  assert.deepEqual([up.data.title, up.data.category, up.data.folderId, up.data.referenceNo, up.data.fileName], ["Fitness certificate", "Legal / MLC", legal.id, "CERT/2026/0009", "case-paper.pdf"]);
  const plain = await upload(ADMIN, { ownerType: "patient", ownerId: String(p.id) });
  assert.deepEqual([plain.data.title, plain.data.folderId, plain.data.category], ["case-paper.pdf", null, "General"], "no title → the file name; no folder → not filed");

  const list = (await as(ADMIN, "GET", `/api/documents?all=true&owner_type=patient`)).data as any[];
  const mine = list.filter((d) => d.ownerId === p.id);
  assert.equal(mine.length, 2);
  assert.equal(mine.find((d) => d.id === up.data.id).folderName, "Legal / MLC");
  assert.equal(((await as(ADMIN, "GET", `/api/documents?all=true&search=CERT%2F2026`)).data as any[]).filter((d) => d.ownerId === p.id).length, 1, "search finds the reference number");
  assert.equal(((await as(ADMIN, "GET", `/api/documents?all=true&search=Fitness`)).data as any[]).filter((d) => d.ownerId === p.id).length, 1, "and the title");

  const other = folders.find((f) => f.name === "OPD Records");
  const edit = await as(ADMIN, "PATCH", `/api/documents/${plain.data.id}`, { title: "Case paper 12 Oct", folderId: other.id, referenceNo: "OPD/77" });
  assert.equal(edit.status, 200, JSON.stringify(edit.error));
  assert.deepEqual([edit.data.title, edit.data.folderId, edit.data.category, edit.data.referenceNo], ["Case paper 12 Oct", other.id, "OPD Records", "OPD/77"], "moving it to a folder files it under that name");
  const out = await as(ADMIN, "PATCH", `/api/documents/${plain.data.id}`, { folderId: null });
  assert.equal(out.data.folderId, null);
  assert.equal((await as(ADMIN, "PATCH", `/api/documents/${plain.data.id}`, { folderId: 99999 })).status, 404);
  assert.equal((await as(ADMIN, "PATCH", `/api/documents/${plain.data.id}`, { title: "x".repeat(200) })).status, 422);
  assert.equal((await upload(ADMIN, { ownerType: "patient", ownerId: String(p.id), folderId: "99999" })).status, 404);
  assert.equal((await upload(ADMIN, { ownerType: "patient", ownerId: String(p.id) }, new File(["x"], "evil.exe", { type: "application/x-msdownload" }))).status, 400, "only PDFs and images");
  assert.equal((await as(ADMIN, "DELETE", `/api/documents/${plain.data.id}`)).status, 204);
});

// ── Templates ────────────────────────────────────────────────────────────────

const tpl = (over: Record<string, unknown> = {}) => ({
  titles: { English: `Dental extraction consent ${++seq}`, Gujarati: "દાંત કાઢવા માટે સંમતિ" },
  bodies: {
    English: "I, {{patient_name}} (age {{age}}), consent to the extraction of the tooth my dentist has explained to me, on {{date}}.",
    Gujarati: "હું, {{patient_name}} (ઉંમર {{age}}), {{date}} ના રોજ મારા દંત ચિકિત્સકે સમજાવેલ દાંત કાઢવા માટે સંમતિ આપું છું.",
  },
  ...over,
});

test("the hospital can write its own consent template; the built-in forms stay as they are", async () => {
  const list0 = (await as(ADMIN, "GET", "/api/consents/templates")).data as any[];
  assert.equal(list0.filter((t) => t.builtIn).length, CONSENT_FORMS.length);
  assert.ok(list0.filter((t) => t.builtIn).every((t) => t.id === null && t.languages.length === 3));

  const bad: [string, Record<string, unknown>][] = [
    ["no English", { titles: { Hindi: "शीर्षक वाला" }, bodies: { Hindi: "यह एक पर्याप्त लंबा हिन्दी पाठ है जो जाँच के लिए है।" } }],
    ["title but no text", { bodies: { English: "" } }],
    ["Gujarati title without its text", { bodies: { English: "I consent to the extraction explained to me by my dentist.", Gujarati: "" } }],
    ["text too short", { bodies: { English: "I agree.", Gujarati: tpl().bodies.Gujarati } }],
    ["unknown placeholder", { bodies: { English: "I, {{patient_nam}}, consent to the extraction explained to me.", Gujarati: tpl().bodies.Gujarati } }],
    ["a built-in's title", { titles: { English: "General consent" } }],
  ];
  for (const [why, over] of bad) assert.equal((await as(ADMIN, "POST", "/api/consents/templates", tpl(over))).status, 422, why);

  const made = await as(ADMIN, "POST", "/api/consents/templates", tpl());
  assert.equal(made.status, 201, JSON.stringify(made.error));
  assert.match(made.data.key, /^custom-[0-9a-f]{8}$/);
  assert.deepEqual([made.data.builtIn, made.data.active, made.data.languages], [false, true, ["English", "Gujarati"]], "only the languages it has text in");
  assert.equal((await as(ADMIN, "POST", "/api/consents/templates", tpl({ titles: { English: made.data.titles.English, Gujarati: "દાંત કાઢવા માટે સંમતિ" } }))).status, 422, "no two with one name");
  const list = (await as(ADMIN, "GET", "/api/consents/templates")).data as any[];
  assert.equal(list.length, list0.length + 1);
  assert.equal(list.at(-1).key, made.data.key, "built-ins first, then the hospital's own");
});

test("a consent made from a template fills in the patient, keeps only the languages the template has, and keeps its wording when the template changes", async () => {
  const p = await newPatient("Dental Patient");
  const t = (await as(ADMIN, "POST", "/api/consents/templates", tpl())).data;
  assert.equal((await make(p.id, { template: t.key, language: "Hindi" })).status, 422, "no Hindi text in this template");
  assert.equal((await make(p.id, { template: "custom-00000000", language: "English" })).status, 422, "unknown template");

  const c = await make(p.id, { template: t.key, language: "Gujarati", includeEnglish: true });
  assert.equal(c.status, 201, JSON.stringify(c.error));
  assert.equal(c.data.formTitle, "દાંત કાઢવા માટે સંમતિ");
  assert.ok(c.data.formBody.includes("Dental Patient") && !c.data.formBody.includes("{{"), "placeholders filled");
  assert.match(c.data.formBody, /ઉંમર \d+/);
  assert.match(c.data.formBody, /\d{1,2} [A-Z][a-z]{2} \d{4}/, "today's date");
  const token = tokenOf((await sendLink(c.data.id)).data.link);
  const form = (await pub("GET", "", token)).data;
  assert.deepEqual(Object.keys(form.texts).sort(), ["English", "Gujarati"]);
  assert.ok(form.texts.English.body.includes("Dental Patient"));
  const doc = (await as(ADMIN, "GET", `/api/consents/${c.data.id}/document`)).data;
  assert.deepEqual(Object.keys(doc.texts).sort(), ["English", "Gujarati"]);

  // edit the template: the issued consent doesn't change, a new one does
  const edit = await as(ADMIN, "PATCH", `/api/consents/templates/${t.id}`, { bodies: { English: "I, {{patient_name}}, now consent to the wording revised on {{date}} by the hospital." } });
  assert.equal(edit.status, 200, JSON.stringify(edit.error));
  assert.ok(edit.data.bodies.English.includes("now consent") && edit.data.bodies.Gujarati, "the Gujarati text was kept");
  assert.ok((await pub("GET", "", token)).data.texts.English.body.includes("on ") && !(await pub("GET", "", token)).data.texts.English.body.includes("now consent"), "the issued consent has its old wording");
  const again = await make(p.id, { template: t.key, language: "English" });
  assert.match(again.data.formBody, /now consent/);

  // switch it off, then delete it: nothing new can be made, nothing issued is lost
  assert.equal((await as(ADMIN, "PATCH", `/api/consents/templates/${t.id}`, { active: false })).data.active, false);
  assert.equal((await make(p.id, { template: t.key, language: "English" })).status, 422, "switched off");
  assert.equal((await as(ADMIN, "DELETE", `/api/consents/templates/${t.id}`)).status, 204);
  assert.equal((await make(p.id, { template: t.key, language: "English" })).status, 422, "deleted");
  assert.equal((await pub("GET", "", token)).status, 200, "the issued consent still opens");
  assert.ok((await pub("GET", "", token)).data.texts.Gujarati);
  assert.equal((await as(ADMIN, "PATCH", `/api/consents/templates/${t.id}`, { active: true })).status, 404);
  assert.equal(((await as(ADMIN, "GET", "/api/consents/templates")).data as any[]).some((x) => x.key === t.key), false);
});

test("template permissions: the front desk can write them, billing can't, built-ins can't be edited or deleted", async () => {
  assert.equal((await as(BILLING, "GET", "/api/consents/templates")).status, 403);
  assert.equal((await as(BILLING, "POST", "/api/consents/templates", tpl())).status, 403);
  assert.equal((await as(DOCTOR, "GET", "/api/consents/templates")).status, 200);
  assert.equal((await as(RECEPTION, "POST", "/api/consents/templates", tpl())).status, 201);
  assert.equal((await request("GET", "/api/consents/templates")).status, 401);
  assert.equal((await as(ADMIN, "PATCH", "/api/consents/templates/99999", { active: false })).status, 404, "no such template");
});

// ── Permissions ──────────────────────────────────────────────────────────────

test("permissions: doctors, the front desk and head nurses make consents and upload papers; billing can't; the sign page needs no login", async () => {
  const p = await newPatient();
  for (const who of [DOCTOR, RECEPTION]) {
    assert.equal((await as(who, "POST", `/api/patients/${p.id}/consents`, { template: "general-consent", language: "Gujarati" })).status, 201, `${who} makes a consent`);
    assert.equal((await as(who, "GET", `/api/patients/${p.id}/consents`)).status, 200);
    assert.equal((await upload(who, { ownerType: "patient", ownerId: String(p.id) })).status, 201, `${who} uploads a paper`);
  }
  assert.equal((await as(BILLING, "GET", `/api/patients/${p.id}/consents`)).status, 403);
  assert.equal((await as(BILLING, "POST", `/api/patients/${p.id}/consents`, { template: "general-consent" })).status, 403);
  assert.equal((await as(BILLING, "GET", "/api/consents")).status, 403);
  assert.equal((await upload(BILLING, { ownerType: "patient", ownerId: String(p.id) })).status, 403);
  assert.equal((await request("GET", "/api/consents")).status, 401, "signed-in staff only");
  assert.equal((await request("GET", `/api/patients/${p.id}/consents`)).status, 401);
  assert.equal((await request("GET", "/api/public/signatures?token=nope")).status, 404, "the sign page is reachable without a session (and just says not found)");
  const mine = ((await as(RECEPTION, "GET", `/api/patients/${p.id}/consents`)).data as any[])[0];
  assert.equal((await as(RECEPTION, "POST", `/api/consents/${mine.id}/link`, { delivery: "qr" })).status, 200);
});

// ── Run ──────────────────────────────────────────────────────────────────────

let passed = 0;
for (const t of tests) {
  try {
    await t.fn();
    passed++;
    console.log(`  PASS  ${t.name}`);
  } catch (e) {
    console.log(`  FAIL  ${t.name}\n        ${(e as Error).stack?.split("\n").slice(0, 6).join("\n        ")}`);
  }
}
console.log(`\n${passed}/${tests.length} passed`);
process.exit(passed === tests.length ? 0 : 1);
