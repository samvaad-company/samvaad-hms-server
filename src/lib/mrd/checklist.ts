/** The MRD file-checking checklist: the 20 things a discharged patient's file must hold, and the PDF that records the check. */

export const MRD_CHECKLIST_ITEMS = [
  "First Page – Patient Name, Age, DOB, Admission Date & Time",
  "Diagnosis – Final Diagnosis Mentioned",
  "First Consultation Paper",
  "Doctor's Prescription",
  "Consent Form – Date & Time Filled",
  "IPD Admission Consent",
  "Patient Daily Progress Notes",
  "Nursing Notes & Vitals Chart",
  "Investigation Reports – Blood, X-ray, USG, ECG etc.",
  "Other Doctor Consultation",
  "Treatment & Medicine Chart",
  "OT Notes / Surgery Notes (If Applicable)",
  "OT Nursing Sheets (If Applicable)",
  "Patient Counselling Notes",
  "Discharge Summary",
  "Final Bill & Payment Details",
  "Insurance / Cashless Documents (If Applicable)",
  "All Reports & Documents Attached",
  "Doctor Signature & Hospital Stamp",
  "Final MRD File Checking & Verification",
] as const;

export interface MrdChecklistData {
  hospitalName: string;
  patientName: string;
  ipdNo: string;
  admissionDate: string;
  dischargeDate: string;
  /** Indexes into MRD_CHECKLIST_ITEMS that were found in the file. */
  checked: number[];
  staffName: string;
  date: string;
}

/** The PDF's standard font only holds Latin text; anything else (a name in another script) would stop the whole PDF, so it becomes "?". */
export function safe(text: string): string {
  return Array.from(text).map((ch) => {
    const c = ch.codePointAt(0)!;
    return c < 256 || c === 0x2013 || c === 0x2014 || c === 0x2019 || c === 0x2018 || c === 0x201c || c === 0x201d ? ch : "?";
  }).join("");
}

/** A one-page A4 PDF of the checklist, with the ticks for what was found and blank lines left for what is still to be written by hand. */
export async function buildMrdChecklistPdf(d: MrdChecklistData): Promise<Blob> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  await drawChecklistPage(doc, d);
  return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
}

/** Adds the checklist as a page of `doc`. */
export async function drawChecklistPage(doc: import("pdf-lib").PDFDocument, d: MrdChecklistData): Promise<void> {
  const { StandardFonts, rgb } = await import("pdf-lib");
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 44;
  const ink = rgb(0.1, 0.12, 0.16), line = rgb(0.62, 0.65, 0.7);
  const fit = (t: string, f: typeof font, size: number, max: number) => {
    let s = safe(t);
    while (s.length > 1 && f.widthOfTextAtSize(s, size) > max) s = s.slice(0, -1);
    return s;
  };

  let y = H - M;
  const centre = (t: string, f: typeof font, size: number) => {
    const s = safe(t);
    page.drawText(s, { x: (W - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color: ink });
  };

  centre("MRD – Medical Records Department", bold, 17); y -= 22;
  centre("Hospital File Checking Checklist", bold, 13); y -= 20;
  if (d.hospitalName.trim()) { centre(d.hospitalName.trim(), font, 11); y -= 8; }
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1, color: ink });
  y -= 22;

  // Patient details: label, then the value over a line.
  page.drawText("Patient Details", { x: M, y, size: 12, font: bold, color: ink }); y -= 20;
  const row = (label: string, value: string, x: number, width: number) => {
    page.drawText(label, { x, y, size: 10.5, font: bold, color: ink });
    const lx = x + bold.widthOfTextAtSize(label, 10.5) + 6;
    page.drawLine({ start: { x: lx, y: y - 3 }, end: { x: x + width, y: y - 3 }, thickness: 0.6, color: line });
    if (value.trim()) page.drawText(fit(value.trim(), font, 10.5, x + width - lx - 2), { x: lx + 2, y, size: 10.5, font, color: ink });
  };
  const full = W - 2 * M, half = (full - 24) / 2;
  row("Patient Name:", d.patientName, M, full); y -= 22;
  row("IPD No.:", d.ipdNo, M, full); y -= 22;
  row("Admission Date:", d.admissionDate, M, half);
  row("Discharge Date:", d.dischargeDate, M + half + 24, half); y -= 30;

  page.drawText("MRD File Checking Checklist", { x: M, y, size: 12, font: bold, color: ink }); y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: line }); y -= 20;

  const ticked = new Set(d.checked);
  MRD_CHECKLIST_ITEMS.forEach((item, i) => {
    const bx = M, by = y - 2, s = 11;
    page.drawRectangle({ x: bx, y: by, width: s, height: s, borderColor: ink, borderWidth: 0.9 });
    if (ticked.has(i)) {
      page.drawLine({ start: { x: bx + 2, y: by + 5.5 }, end: { x: bx + 4.6, y: by + 2.4 }, thickness: 1.6, color: ink });
      page.drawLine({ start: { x: bx + 4.6, y: by + 2.4 }, end: { x: bx + 9.4, y: by + 9 }, thickness: 1.6, color: ink });
    }
    page.drawText(`${i + 1}.`, { x: bx + 19, y, size: 10.5, font: bold, color: ink });
    page.drawText(fit(item, font, 10.5, full - 44), { x: bx + 36, y, size: 10.5, font, color: ink });
    y -= 25;
  });

  y -= 14;
  const third = (full - 40) / 3;
  row("MRD Staff Name:", d.staffName, M, third + 30);
  row("Signature:", "", M + third + 50, third - 10);
  row("Date:", d.date, M + 2 * third + 60, third - 20);

}
