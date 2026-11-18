/**
 * Builds the claim-form templates in public/claims/ from the insurers' own claim-form PDFs.
 *
 *   npm i --no-save pdfjs-dist@4.10.38
 *   node scripts/claims/build-templates.mjs <folder with the claim form PDFs>
 *
 * For each PDF it reads the printed labels and the drawn boxes, finds where each standard detail goes (the insured's Part A, the
 * hospital's Part B), and writes <key>.json (the template, see src/lib/claims/claim-fill.ts) and a copy of the PDF as <key>.pdf.
 * Forms that cannot be mapped box by box (scans, outlined text) are marked `summary`: the details go on a "Claim details" sheet.
 */
import { refine } from "./refine.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractPages } from "./extract-lines.mjs";
import { detect } from "./detect.mjs";

const SRC = process.argv[2];
if (!SRC) { console.error("usage: node scripts/claims/build-templates.mjs <folder with the claim form PDFs>"); process.exit(1); }
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/claims");

/** The insurers' file names → form keys (the same keys as src/lib/claims/forms.ts). */
const FILES = {
  "Acko Group Health Insurance.pdf": "acko", "Aditya birla claim form.pdf": "aditya-birla", "bajaj genral insurance.pdf": "bajaj-allianz", "care _Health_Claim_Form.pdf": "care",
  "chola ms Health Claim Form.pdf": "chola-ms", "edelweiss.pdf": "edelweiss", "FutureGeneraliClaimForm.pdf": "generali-central", "HDFC ERGO Health_Suraksha_Claim_Form.pdf": "hdfc-ergo",
  "ICICI_Prudential.pdf": "icici-pru", "IcicLombardHealthCareClaimForm.pdf": "icici-lombard", "IFFCO-TOKIO-Health Claim Form.pdf": "iffco-tokio", "Induslnd Health_(TPA)_Claim_FormA.pdf": "indusind-reliance",
  "kotak mahindraHealth_Claim_Form.pdf": "kotak", "liberty genral GMC Claim Form.pdf": "liberty", "MAGMA Health_Claim_Form.pdf": "magma-hdi", "Manipal_cigna.pdf": "manipal-cigna",
  "NaviSmartHealth Claim Form - Reimbursement.pdf": "navi", "Niva Bupa ReimbursementClaimForm.pdf": "niva-bupa", "raheja qbe Health_Claim_Form.pdf": "raheja-qbe", "Roayal Sundaram Health claim form.pdf": "royal-sundaram",
  "SBI Retail_Health_Claim_Form.pdf": "sbi-general", "Star_Claim_Form.pdf": "star-health", "TATA AIG Group_Medicare_Claim_Form.pdf": "tata-aig", "Universal Insurance Group Health Claim form.pdf": "universal-sompo",
};
/** Per form: `drop` details not to print (the label found was not the right one), `summary` to force or forbid the details sheet. */

// Hand-mapping helpers. Ranges are "x0-x1" spans of the hint letters printed in each box (points, from the left).
const span = (str) => str.trim().split(/\s+/).map((r) => r.split("-").map(Number));
const mid = (r) => (r[0] + r[1]) / 2;
/** A row of letter boxes: the characters go in the box centres and the printed hint letters are wiped. */
const boxes = (p, y, str) => { const r = span(str); const c = r.map(mid); return { p, x: +(c[0] - 4).toFixed(1), y, w: +(c[c.length - 1] - c[0] + 8).toFixed(1), cells: c, cw: 10, wipe: c.map((x) => ({ x: +(x - 3.8).toFixed(1), y: +(y - 7.6).toFixed(1), w: 7.6, h: 9.2 })) }; };
/** Evenly spread boxes inside printed runs "x0-x1:count". */
const runs = (p, y, str) => { const c = []; for (const t of str.trim().split(/\s+/)) { const [r, n] = t.split(":"); const [a, b] = r.split("-").map(Number); const k = Number(n); for (let i = 0; i < k; i++) c.push(a + ((b - a) * (i + 0.5)) / k); } return { p, x: +(c[0] - 4).toFixed(1), y, w: +(c[c.length - 1] - c[0] + 8).toFixed(1), cells: c, cw: 10, wipe: c.map((x) => ({ x: +(x - 3.8).toFixed(1), y: +(y - 7.6).toFixed(1), w: 7.6, h: 9.2 })) }; };
/** A name written across boxes that carry hint words or letters: all the hints are wiped, the name runs across. */
const across = (p, x, y, w, hints) => ({ p, x, y, w, wipe: span(hints).map((r) => ({ x: +(r[0] - 1).toFixed(1), y: +(y - 7.6).toFixed(1), w: +(r[1] - r[0] + 2).toFixed(1), h: 9.2 })) });


/** One row of letter boxes (edges every `pitch` from x0; y1 is the bottom edge): characters go one to a box; `wipe` clears printed hint letters. */
const R = (p, x0, y1, n, wipe = false, pitch = 13.3) => ({ p, x: x0, y: +(y1 - 3.7).toFixed(1), w: +(n * pitch).toFixed(1), comb: pitch, ...(wipe ? { wipe: Array.from({ length: n }, (_, i) => ({ x: +(x0 + i * pitch + 1).toFixed(1), y: +(y1 - 12.5).toFixed(1), w: +(pitch - 2).toFixed(1), h: 11.5 })) } : {}) });
/** Separate boxes (e.g. HH and MM) written as one value: the characters go in the box centres. */
const C = (p, y1, xs, pitch = 13.3, wipe = true) => ({ p, x: xs[0], y: +(y1 - 3.7).toFixed(1), w: +(xs.length * pitch).toFixed(1), cells: xs.map((x) => +(x + pitch / 2).toFixed(2)), cw: pitch, ...(wipe ? { wipe: xs.map((x) => ({ x: +(x + 1).toFixed(1), y: +(y1 - 12.5).toFixed(1), w: +(pitch - 2).toFixed(1), h: 11.5 })) } : {}) });
/** A date or time on short lines: each part is centred on its line (spans "x0-x1"); y is the line's height. */
const L = (p, y, str) => { const g = span(str).map(([a, b]) => ({ x: a, w: +(b - a).toFixed(1) })); return { p, x: g[0].x, y: +(y - 1.8).toFixed(1), w: +(g[g.length - 1].x + g[g.length - 1].w - g[0].x).toFixed(1), segs: g }; };
/** Boxes given by their centres (a date or time row whose boxes are not evenly spaced). */
const Cc = (p, y1, cs, pitch = 14) => ({ p, x: +(cs[0] - pitch / 2).toFixed(1), y: +(y1 - 3.3).toFixed(1), w: +(cs[cs.length - 1] - cs[0] + pitch).toFixed(1), cells: cs, cw: 12, wipe: cs.map((c) => ({ x: +(c - pitch / 2 + 1).toFixed(1), y: +(y1 - 12).toFixed(1), w: +(pitch - 2).toFixed(1), h: 11 })) });
/** An answer that runs across several rows of boxes: [x0, count, bottom edge] for each row, boxes `pitch` wide. */
const Flow = (p, rows, pitch = 12) => ({ p, x: rows[0][0], y: +(rows[0][2] - 3.5).toFixed(1), w: +(rows[0][1] * pitch).toFixed(1), flow: rows.map(([x0, n, y1]) => ({ cells: Array.from({ length: n }, (_, i) => +(x0 + pitch * (i + 0.5)).toFixed(2)), y: +(y1 - 3.5).toFixed(1) })) });
/** A tick box for a ring; y is its bottom edge. */
const box = (p, x, y, s = 9) => ({ p, x, y, w: s, h: s });

const HDFC_D = "116-121 126-131 139-145 149-155 163-168 173-178 183-188 193-198";
const HDFC_O = "386-391 396-401 410-416 420-426 434-438 444-448 454-459 464-469";
const HDFC_T = "252-257 262-267 278-283 288-293";
const ICL_DD = (a) => a; // ICICI Lombard date boxes include the printed slashes

const OVERRIDES = {
  // Royal Sundaram: one letter to a box, 32 boxes a row (13.3 pt apart); the printed text has no readable layer, so every row is mapped by hand.
  "royal-sundaram": {
    only: true, partB: true, summary: false,
    manual: {
      policyNo: [R(1, 120.9, 114, 16)],
      cardId: [R(1, 120.9, 130, 32)],
      insuredName: [R(1, 120.9, 146, 32)],
      address: [R(1, 120.9, 162, 32), R(1, 120.9, 430, 32)],
      phone: [R(1, 120.9, 231, 10)],
      email: [{ p: 1, x: 296, y: 228, w: 250 }],
      patientName: [R(1, 120.9, 377.5, 32)],
      age: [R(1, 226.7, 393.5, 2, true)],
      dob: [R(1, 440.9, 393.5, 8, true)],
      diagnosis: [R(1, 120.9, 344, 32)],
      hospitalName: [R(1, 120.9, 581, 32)],
      hospitalAddress: [R(1, 120.9, 597, 32)],
      admissionDate: [R(1, 120.9, 686.5, 8, true)],
      admissionTime: [C(1, 686.5, [249.8, 263.1, 284.5, 297.8])],
      dischargeDate: [R(1, 357.3, 686.5, 8, true)],
      totalBill: [R(2, 390.1, 63.1, 5, false, 13.6), R(2, 390.1, 110.8, 5, false, 13.6)],
    },
    manualChoices: { gender: [{ Male: box(1, 120.9, 390.5, 8), Female: box(1, 162.5, 390.5, 8) }] },
  },
  // SBI General: one letter to a box, 30 boxes a row; the printed text is drawn as outlines, so every row is mapped by hand.
  "sbi-general": {
    only: true, partB: true, summary: false,
    manual: {
      policyNo: [R(1, 114.5, 193, 14)],
      insuredName: [R(1, 159.2, 256.5, 30, true), R(1, 159.2, 275, 30, true), R(3, 159.7, 513.5, 30)],
      dob: [R(1, 408.5, 292.5, 8, true)],
      cardId: [R(1, 408.5, 310.5, 11, false, 13.7)],
      address: [R(1, 195.1, 366.5, 27, false, 13.5)],
      phone: [R(1, 394.8, 421.5, 12, false, 13.7)],
      email: [{ p: 1, x: 198, y: 435.5, w: 355 }],
      diagnosis: [{ p: 1, x: 161, y: 520.5, w: 395 }, { p: 4, x: 160, y: 246, w: 395 }],
      admissionDate: [R(1, 159.2, 730.5, 8, true)],
      admissionTime: [R(1, 347.6, 730.5, 5)],
      dischargeDate: [R(1, 159.2, 748, 8, true)],
      hospitalName: [R(2, 159.7, 133.5, 30)],
      doctorName: [R(2, 159.7, 151.5, 30)],
      doctorReg: [R(2, 439.6, 169, 9)],
      hospitalAddress: [{ p: 2, x: 184, y: 203, w: 158, size: 7.5 }],
      hospitalPhone: [R(2, 195.8, 260.5, 11)],
      hospitalEmail: [{ p: 2, x: 198, y: 275, w: 355 }],
      patientName: [R(4, 159.2, 197, 30)],
    },
    manualChoices: {
      gender: [{ Male: box(1, 158.5, 310.5, 13), Female: box(1, 194.9, 310.5, 13) }],
      admissionType: [{ Emergency: box(2, 158.9, 46, 13), Planned: box(2, 254.6, 46, 13) }],
    },
  },
  // Generali Central: a few lines the reader missed.
  "generali-central": {
    manual: {
      policyNo: [{ p: 0, x: 114, y: 207, w: 182 }],
      cardId: [{ p: 0, x: 388, y: 207, w: 175 }],
      patientName: [{ p: 0, x: 171, y: 362.3, w: 390 }, { p: 0, x: 152, y: 711.5, w: 210 }],
      age: [{ p: 0, x: 293, y: 390.2, w: 78 }],
      diagnosis: [{ p: 0, x: 118, y: 503.5, w: 218 }],
      admissionDate: [{ p: 0, x: 138, y: 521.4, w: 64 }],
      dischargeDate: [{ p: 0, x: 262, y: 521.4, w: 64 }],
      doctorName: [{ p: 0, x: 168, y: 537.5, w: 158 }],
      totalBill: [C(0, 470.5, [201.6, 227.9, 254.2, 280.5, 306.8, 333.1, 359.4], 26.3, false)],
    },
    manualChoices: { gender: [{ Male: box(0, 426.5, 392.5, 10), Female: box(0, 460, 392.5, 10) }] },
  },
  // Navi: underlined lines with the answer after the colon; Part A is page 1.
  "navi": {
    drop: ["occupation"],
    manual: {
      policyNo: [{ p: 0, x: 228, y: 139.8, w: 292 }],
      cardId: [{ p: 0, x: 458, y: 153.5, w: 66, size: 8 }],
      insuredName: [{ p: 0, x: 176, y: 167.5, w: 345 }],
      address: [{ p: 0, x: 176, y: 185, w: 345, lines: 2, lh: 13.5 }, { p: 0, x: 190, y: 515.5, w: 360, lines: 2, lh: 13.5 }],
      email: [{ p: 0, x: 414, y: 221.5, w: 128, size: 7.5 }],
      patientName: [{ p: 0, x: 165, y: 421.5, w: 146 }],
      age: [{ p: 0, x: 198, y: 439.5, w: 30, cells: [205.6, 220.9], cw: 12, wipe: [{ x: 199.5, y: 432.8, w: 11, h: 9.5 }, { x: 215, y: 432.8, w: 11, h: 9.5 }] }],
      dob: [{ p: 0, x: 392, y: 439.5, w: 150, cells: [398, 413.8, 442, 460.1, 487.9, 503.2, 518.5, 533.8], cw: 13, wipe: [398, 413.8, 442, 460.1, 487.9, 503.2, 518.5, 533.8].map((c) => ({ x: +(c - 5.5).toFixed(1), y: 432.8, w: 11, h: 9.5 })) }],
    },
    add: {
      patientName: [{ p: 4, x: 224, y: 247.5, w: 300 }],
      age: [Cc(4, 283, [281.7, 298.3], 16)],
      dob: [Cc(4, 297, [249.8, 266, 298.4, 314.6, 347, 363.2], 16)],
      admissionDate: [Cc(4, 311, [235.2, 251.4, 283.8, 300, 332.4, 348.6], 16)],
      admissionTime: [Cc(4, 311.5, [443.7, 462.2, 494.5, 513.2], 18)],
      dischargeDate: [Cc(4, 325.5, [235.2, 251.4, 283.8, 300, 332.4, 348.6], 16)],
      hospitalReg: [{ p: 4, x: 260, y: 200.5, w: 105 }],
      hospitalPhone: [{ p: 4, x: 446, y: 200.5, w: 95 }],
    },
  },
  // Tata AIG: gender and occupation are tick boxes, not lines.
  "tata-aig": {
    drop: ["gender", "occupation"],
    manualChoices: { gender: [{ Male: box(1, 103.8, 537.5, 11.4), Female: box(1, 153.8, 537.5, 11.4), Other: box(1, 228.6, 537.5, 11.4) }, { Male: box(3, 291.4, 375.5, 11.4), Female: box(3, 325.4, 375.5, 11.4) }] },
  },
  // IFFCO Tokio: the age and the admission time go in the cell right of their label, where the hint (years / HH MM) is printed.
  "iffco-tokio": {
    add: {
      age: [{ ...L(1, 440.3, "284-313.8"), wipe: [{ x: 289, y: 431.5, w: 20, h: 9 }] }],
      admissionTime: [{ ...L(1, 644.1, "267-282 282-299"), wipe: [{ x: 270, y: 635.5, w: 11, h: 8 }, { x: 285, y: 635.5, w: 13, h: 8 }] }],
    },
  },
  // HDFC ERGO: names, dates and times sit in letter boxes.
  "hdfc-ergo": {
    manual: {
      dob: [boxes(1, 357.2, "83-88 93-98 107-113 117-123 131-135 141-146 151-156 161-166")],
      admissionDate: [boxes(1, 494.5, HDFC_D), boxes(4, 249.4, HDFC_D)],
      admissionTime: [boxes(1, 494.5, HDFC_T), boxes(4, 249.4, HDFC_T)],
      dischargeDate: [boxes(1, 494.5, HDFC_O), boxes(4, 249.4, HDFC_O)],
    },
  },
  // Bajaj Allianz: dates and times sit in letter boxes (D D M M Y Y Y Y).
  "bajaj-allianz": {
    manual: {
      dob: [runs(0, 509.5, "426-444:2 453-474:2 484-489:1 496-502:1 509-525:2"), runs(3, 249.3, "493-547:6")],
      admissionDate: [runs(0, 700, "114-132:2 140-161:2 170-176:1 183-188:1 195-211:2"), runs(3, 265.3, "119-173:6")],
      admissionTime: [runs(0, 700, "246-264:2 274-294:2"), runs(3, 265.3, "234-248:2 256-272:2")],
      dischargeDate: [runs(0, 700, "374-392:2 400-421:2 431-436:1 443-448:1 456-472:2"), runs(3, 265.3, "378-432:6")],
    },
  },
  // ICICI Lombard: names in FIRST / MIDDLE / LAST boxes; dates in DD/MM/YYYY boxes with the slashes printed.
  "icici-lombard": {
    drop: ["hospitalEmail", "hospitalPhone"],
    add: { address: [Flow(2, [[161.3, 34, 254.1], [54.1, 43, 267.5], [54.1, 21, 281.6]])] },
    manual: {
      dob: [boxes(2, 208.2, "251-255 264-268 274-276 281-287 293-299 304-307 313-316 325-328 337-341 348-352"), { p: 4, x: 476.9, y: 234.4, w: 107.1 }],
      admissionDate: [boxes(2, 512.5, "130-134 143-147 154-156 160-166 172-178 184-186 192-195 204-207 216-220 228-231"), boxes(4, 246.7, "120-124 133-137 143-145 150-155 162-168 173-175 181-185 194-197 206-209 217-221")],
      dischargeDate: [boxes(2, 512.5, "389-393 402-406 412-414 419-424 431-436 442-444 450-454 462-466 475-478 486-490"), boxes(4, 246.7, "379-383 392-396 402-404 408-414 420-426 432-434 440-444 452-456 464-468 476-479")],
    },
  },
  // Star's PDF has no readable text: positions read off the form (points from the top-left; page numbers start at 0).
  "star-health": {
    only: true, partB: true, summary: false,
    manual: {
      insuredName: [{ p: 1, x: 101, y: 158.8, w: 455 }],
      policyNo: [{ p: 1, x: 101, y: 130.6, w: 236 }],
      patientName: [{ p: 1, x: 68, y: 303, w: 485 }, { p: 4, x: 99, y: 203, w: 455 }],
      address: [{ p: 1, x: 101, y: 173, w: 455, lines: 2, lh: 14.2 }, { p: 1, x: 120, y: 362, w: 435, lines: 2, lh: 12.6 }],
      phone: [{ p: 1, x: 202, y: 402.6, w: 152 }],
      email: [{ p: 1, x: 394, y: 403, w: 160 }],
      dob: [L(1, 317.9, "337.6-352 356.7-371.1 376.4-390.8"), L(4, 218.9, "469.5-492.6 499.6-524 533-557.5")],
      age: [{ p: 1, x: 189, y: 320, w: 24, cells: [195, 209], cw: 11 }, { p: 4, x: 347, y: 220, w: 24, cells: [353, 364.6], cw: 11 }],
      hospitalName: [{ p: 1, x: 123, y: 425, w: 340 }, { p: 4, x: 97, y: 133, w: 458 }],
      hospitalPhone: [{ p: 4, x: 262, y: 176.5, w: 135 }],
      hospitalEmail: [{ p: 4, x: 435, y: 176.8, w: 120, size: 8 }],
      doctorName: [{ p: 4, x: 111, y: 163, w: 280 }],
      admissionDate: [L(1, 456, "340.6-358 363.4-380.9 386.3-403.6"), L(4, 234.7, "92.9-119 126.8-154.5 164.7-192.3")],
      admissionTime: [L(1, 455.1, "473.8-488.2 494.1-508.6"), L(4, 234.2, "230.8-256.9 264.7-292.4")],
      dischargeDate: [L(1, 469.1, "93.5-111 116.4-133.9 139.3-156.6"), L(4, 236.3, "364.6-390.7 398.5-426.2 436.4-464")],
      diagnosis: [{ p: 4, x: 218, y: 303, w: 86, size: 7 }],
      totalBill: [{ p: 1, x: 168, y: 528, w: 85 }, { p: 1, x: 168, y: 590, w: 85 }],
    },
    manualChoices: {
      gender: [{ Male: { p: 1, x: 85, y: 322, w: 10, h: 10 }, Female: { p: 1, x: 123, y: 322, w: 10, h: 10 } }, { Male: { p: 4, x: 264, y: 222, w: 10, h: 10 }, Female: { p: 4, x: 285, y: 222, w: 10, h: 10 } }],
      admissionType: [{ Emergency: { p: 4, x: 124, y: 252, w: 10, h: 10 }, Planned: { p: 4, x: 168, y: 252, w: 10, h: 10 } }],
    },
  },
};

fs.mkdirSync(OUT, { recursive: true });
for (const [file, key] of Object.entries(FILES)) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) { console.log(`skip ${key}: ${file} not found`); continue; }
  const bytes = fs.readFileSync(src);
  const pages = await extractPages(bytes);
  const ov = OVERRIDES[key] ?? {};
  const { fields, choices } = ov.only ? { fields: {}, choices: {} } : detect(pages, ov);
  const refined = ov.only ? {} : refine(pages, fields, ov.drop ?? []);
  const tpl = { pdf: `${key}.pdf`, pages: pages.length, partB: false, fields: {}, choices: {} };
  for (const [k, spots] of Object.entries(fields)) {
    if (ov.drop?.includes(k)) continue;
    tpl.fields[k] = spots.map((s) => ({ p: s.p, x: s.x, y: s.y, w: s.w, ...(s.comb ? { comb: s.comb } : {}), ...(s.cells ? { cells: s.cells, cw: s.cw, ...(s.by ? { by: s.by, bh: s.bh } : {}) } : {}), ...(s.segs ? { segs: s.segs } : {}), ...(s.flow ? { flow: s.flow } : {}), ...(s.wipe ? { wipe: s.wipe } : {}) }));
    if (spots.some((s) => ["hospital", "patientB", "ailment", "nonnet"].includes(s.ctx))) tpl.partB = true;
  }
  // An answer line: the text starts where the line does and sits just above it, not over the label.
  for (const spots of Object.values(tpl.fields)) for (const s of spots) {
    if (s.cells || s.comb) continue;
    const near = (pages[s.p]?.hlines ?? []).filter((h) => h.y >= s.y - 0.5 && h.y <= s.y + 7 && h.x1 > s.x + 20 && h.x0 < s.x + s.w - 20).sort((a, b) => a.y - b.y)[0];
    if (!near) continue;
    const x = Math.max(s.x, near.x0 + 2), w = Math.min(s.x + s.w, near.x1) - x;
    if (w < 28) continue;
    s.x = +x.toFixed(1); s.w = +w.toFixed(1); s.y = +(near.y - 1.8).toFixed(1);
  }
  for (const [k, list] of Object.entries(choices)) if (!ov.drop?.includes(k)) tpl.choices[k] = list[0];
  for (const [k, rows] of Object.entries(refined)) tpl.choices[k] = rows;
  for (const [k, spots] of Object.entries(ov.manual ?? {})) tpl.fields[k] = spots;
  // `add`: more places for a detail, replacing whatever was found on the same pages
  for (const [k, spots] of Object.entries(ov.add ?? {})) { const pgs = new Set(spots.map((q) => q.p)); tpl.fields[k] = [...(tpl.fields[k] ?? []).filter((q) => !pgs.has(q.p)), ...spots]; }
  for (const [k, v] of Object.entries(ov.manualChoices ?? {})) tpl.choices[k] = v;
  if (ov.partB !== undefined) tpl.partB = ov.partB;
  if (ov.summary ?? (!tpl.partB || Object.keys(tpl.fields).length < 8)) tpl.summary = true;
  if (!Object.keys(tpl.choices).length) delete tpl.choices;
  fs.writeFileSync(path.join(OUT, `${key}.json`), JSON.stringify(tpl));
  fs.copyFileSync(src, path.join(OUT, `${key}.pdf`));
  console.log(`${key.padEnd(18)} ${String(Object.keys(tpl.fields).length).padStart(2)} details${tpl.partB ? ", Part B" : ", no Part B"}${tpl.summary ? ", details sheet" : ""}`);
}
