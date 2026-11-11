"use client";

/**
 * The "Download" tab of Prescriptions: pick a patient and a date range, tick the prescriptions wanted, and save them
 * together as one PDF. The PDF is made in the browser from the prescriptions themselves (one page per prescription).
 */
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import { api } from "@/lib/api/client";
import { formatDate, toIsoDate, todayIso } from "@/lib/dates";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { useHospital } from "@/components/shared/DocumentLetterhead";
import { prescriptionToPdf, downloadPdf } from "@/lib/preauth/packet";
import type { PrescriptionDTO } from "@/types/api";
import type { PacketPrescriptionDTO } from "@/types/preauth";

const field = "h-[36px] rounded-[10px] border border-[color:var(--line)] bg-[color:var(--surface)] px-3 text-[13px] text-[color:var(--ink)] outline-none focus:border-[color:var(--brand)]";
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return toIsoDate(d); };

export function DownloadPrescriptions({ prescriptions }: { prescriptions: PrescriptionDTO[] }) {
  const hospital = useHospital();
  const [patient, setPatient] = useState("");
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayIso());
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Patients who have at least one prescription (a patient is matched by id, or by name when the prescription has no patient record).
  const keyOf = (r: PrescriptionDTO) => (r.patientId != null ? `id:${r.patientId}` : `name:${r.patientName}`);
  const patients = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const r of prescriptions) { const k = keyOf(r); const e = m.get(k); m.set(k, { label: r.patientName, n: (e?.n ?? 0) + 1 }); }
    return [...m.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [prescriptions]);

  const matches = useMemo(
    () => prescriptions.filter(r => { const d = toIsoDate(r.date); return keyOf(r) === patient && d && (!from || d >= from) && (!to || d <= to); })
      .sort((a, b) => toIsoDate(b.date).localeCompare(toIsoDate(a.date))),
    [prescriptions, patient, from, to],
  );
  const chosen = matches.filter(r => picked.has(r.id));
  const allOn = matches.length > 0 && chosen.length === matches.length;

  const preset = (days: number | null) => { setFrom(days === null ? "" : daysAgo(days)); setTo(todayIso()); setPicked(new Set()); };
  const toggle = (id: number) => setPicked(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  async function download() {
    const list = chosen.length ? chosen : matches;
    if (!list.length) return;
    setBusy(true); setError(null);
    try {
      const out = await PDFDocument.create();
      for (const r of list) {
        const rx = await api.get<PrescriptionDTO>(`/prescriptions/${r.id}`);
        const dto: PacketPrescriptionDTO = {
          id: rx.id, rxNumber: rx.rxNumber, date: formatDate(toIsoDate(rx.date)), doctor: rx.doctor, diagnosis: rx.diagnosis, patientName: rx.patientName, patientAge: rx.patientAge,
          gender: rx.patient?.gender ?? null, allergies: rx.patient?.allergies ?? null,
          items: (rx.items ?? []).map(i => ({ medicineName: i.medicineName, dosage: i.dosage, frequency: i.frequency, duration: i.duration, instructions: i.instructions })),
        };
        const doc = await prescriptionToPdf(dto, hospital.name);
        for (const p of await out.copyPages(doc, doc.getPageIndices())) out.addPage(p);
      }
      const name = list[0].patientName.replace(/[^\w ]+/g, "").trim().replace(/\s+/g, "-") || "patient";
      downloadPdf(new Blob([(await out.save()) as BlobPart], { type: "application/pdf" }), `Prescriptions-${name}-${from || "start"}-to-${to || "today"}.pdf`);
    } catch {
      setError("The PDF couldn't be made. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-5 py-5 flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 min-w-[260px] flex-1 max-w-[360px]">
          <span className="text-[12px] text-[color:var(--ink-soft)]">Patient</span>
          <SearchSelect placeholder="Select a patient…" value={patient} onChange={v => { setPatient(v); setPicked(new Set()); }}
            options={patients.map(([k, p]) => ({ value: k, label: p.label, hint: `${p.n} prescription${p.n === 1 ? "" : "s"}` }))} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-[color:var(--ink-soft)]">From</span>
          <input type="date" value={from} max={to || undefined} onChange={e => { setFrom(e.target.value); setPicked(new Set()); }} className={field} aria-label="From date" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-[color:var(--ink-soft)]">To</span>
          <input type="date" value={to} min={from || undefined} onChange={e => { setTo(e.target.value); setPicked(new Set()); }} className={field} aria-label="To date" />
        </label>
        <div className="flex gap-2 pb-[2px]">
          {([["7 days", 7], ["30 days", 30], ["90 days", 90], ["All time", null]] as const).map(([l, d]) => (
            <button key={l} type="button" onClick={() => preset(d)} className="h-[28px] px-3 rounded-full border border-[color:var(--line)] text-[12px] text-[color:var(--ink-soft)] hover:text-[color:var(--ink)] hover:bg-[color:var(--subtle)] cursor-pointer">{l}</button>
          ))}
        </div>
      </div>

      {!patient ? (
        <div className="py-12 text-center text-[14px] text-[color:var(--ink-soft)]">Choose a patient to see their prescriptions.</div>
      ) : matches.length === 0 ? (
        <div className="py-12 text-center text-[14px] text-[color:var(--ink-soft)]">No prescriptions for this patient in that date range.</div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-[13px] text-[color:var(--ink)] cursor-pointer">
              <input type="checkbox" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(matches.map(r => r.id)))} />
              {matches.length} prescription{matches.length === 1 ? "" : "s"} · {chosen.length ? `${chosen.length} selected` : "all will be downloaded"}
            </label>
            <button type="button" onClick={() => void download()} disabled={busy}
              className="inline-flex items-center gap-2 h-[36px] px-5 rounded-full bg-[color:var(--brand)] text-white text-[13px] hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
              <Download size={14} /> {busy ? "Preparing PDF…" : `Download PDF (${chosen.length || matches.length})`}
            </button>
          </div>
          {error && <p className="text-[12px] text-[#c0392b]">{error}</p>}
          <ul className="border border-[color:var(--line)] rounded-[12px] divide-y divide-[color:var(--line)] overflow-hidden">
            {matches.map(r => (
              <li key={r.id}>
                <label className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[color:var(--subtle)]">
                  <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} />
                  <span className="text-[13px] font-medium text-[color:var(--ink)] w-[150px] shrink-0">{r.rxNumber}</span>
                  <span className="text-[13px] text-[color:var(--ink-soft)] w-[110px] shrink-0">{formatDate(toIsoDate(r.date))}</span>
                  <span className="text-[13px] text-[color:var(--ink)] flex-1 min-w-0 truncate">{r.diagnosis || "—"}</span>
                  <span className="text-[12px] text-[color:var(--ink-soft)] shrink-0">{r.doctor} · {r.medicineCount} medicine{r.medicineCount === 1 ? "" : "s"}</span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
