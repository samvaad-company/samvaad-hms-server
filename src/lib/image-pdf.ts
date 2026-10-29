"use client";

/**
 * Turn photos of paper (case papers, signed forms, prescriptions) into one PDF, entirely in the browser — nothing is
 * sent anywhere until the PDF is uploaded. Each photo is straightened by its camera orientation, shrunk to a size that
 * stays readable but light, saved as a JPEG and placed on its own A4 page (portrait or landscape to suit the photo).
 *
 * The PDF is written by hand: a catalog, one page + one image per photo, and a cross-reference table.
 */

const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 24;
/** The longest side a photo is kept at, in pixels: enough to read handwriting, small enough to upload quickly. */
const MAX_SIDE = 2000;
const QUALITY = 0.82;

interface Page { jpeg: Uint8Array; width: number; height: number }

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`${file.name} isn't a picture this browser can read`));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function toPage(file: File): Promise<Page> {
  const img = await decode(file);
  const w0 = "naturalWidth" in img ? img.naturalWidth : img.width;
  const h0 = "naturalHeight" in img ? img.naturalHeight : img.height;
  if (!w0 || !h0) throw new Error(`${file.name} is empty`);
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const width = Math.max(1, Math.round(w0 * scale));
  const height = Math.max(1, Math.round(h0 * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't prepare the picture");
  ctx.fillStyle = "#fff"; // a transparent PNG becomes white paper, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  if ("close" in img) img.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error(`${file.name} couldn't be prepared`);
  return { jpeg: new Uint8Array(await blob.arrayBuffer()), width, height };
}

const enc = new TextEncoder();

/** Build a PDF with one photo per page. Throws a readable message if a photo can't be read. */
export async function imagesToPdf(files: File[]): Promise<Blob> {
  if (files.length === 0) throw new Error("Add at least one photo");
  const pages: Page[] = [];
  for (const f of files) pages.push(await toPage(f));

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (b: Uint8Array) => { chunks.push(b); length += b.length; };
  const text = (s: string) => push(enc.encode(s));
  const object = (n: number, body: () => void) => { offsets[n] = length; text(`${n} 0 obj\n`); body(); text("\nendobj\n"); };

  // Object numbers: 1 catalog, 2 pages, then for photo i: page 3+3i, contents 4+3i, image 5+3i.
  const pageObj = (i: number) => 3 + 3 * i;
  text("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  object(1, () => text("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => text(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(" ")}] >>`));

  pages.forEach((p, i) => {
    const landscape = p.width > p.height;
    const pw = landscape ? A4.h : A4.w;
    const ph = landscape ? A4.w : A4.h;
    const fit = Math.min((pw - 2 * MARGIN) / p.width, (ph - 2 * MARGIN) / p.height);
    const dw = p.width * fit;
    const dh = p.height * fit;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;
    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    object(pageObj(i), () => text(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}] /Resources << /XObject << /Im0 ${pageObj(i) + 2} 0 R >> >> /Contents ${pageObj(i) + 1} 0 R >>`));
    object(pageObj(i) + 1, () => text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`));
    object(pageObj(i) + 2, () => {
      text(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`);
      push(p.jpeg);
      text("\nendstream");
    });
  });

  const count = 3 + 3 * pages.length;
  const xref = length;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
