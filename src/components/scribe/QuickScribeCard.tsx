"use client";

/**
 * One-tap scribing for the doctor, from the top of the appointment's right-hand column: Start → the microphone is listened to (a live
 * level meter shows it is catching the voice) → Stop → the recording is transcribed and saved as a scribing note on this appointment.
 * Every note, from here or from the full scribe below, is listed in the "Consultation Scribe" section at the bottom of the page.
 */
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, Sparkles, Square } from "lucide-react";
import { api } from "@/lib/api/client";
import { toWavChunks } from "@/lib/audio";

interface Props {
  appointmentId: number;
  patientName: string;
  doctorName: string;
  doctorId?: number | null;
  patientId?: number | null;
  /** A note was saved: refresh the list of scribing notes. */
  onSaved: () => void;
}

const BARS = 28;
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

export function QuickScribeCard({ appointmentId, patientName, doctorName, doctorId, patientId, onSaved }: Props) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [working, setWorking] = useState<"" | "transcribing" | "saving">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [levels, setLevels] = useState<number[]>(() => Array(BARS).fill(0.08));

  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);
  const seconds0 = useRef(0);

  const cleanup = () => {
    if (timer.current) clearInterval(timer.current);
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    void audioCtx.current?.close().catch(() => undefined);
    audioCtx.current = null;
    setLevels(Array(BARS).fill(0.08));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => cleanup(), []);

  async function start() {
    setError(""); setDone("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const rec = new MediaRecorder(media);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.current.push(e.data); };
      rec.onstop = () => { void finish(new Blob(chunks.current, { type: "audio/webm" })); };
      rec.start();
      recorder.current = rec;

      // The voice level, drawn as moving bars.
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(media).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const step = Math.max(1, Math.floor(data.length / BARS));
        setLevels(Array.from({ length: BARS }, (_, i) => Math.max(0.08, Math.min(1, (data[i * step] ?? 0) / 200))));
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      seconds0.current = 0;
      setSeconds(0);
      timer.current = setInterval(() => { seconds0.current += 1; setSeconds(seconds0.current); }, 1000);
      setRecording(true);
    } catch {
      cleanup();
      setError("Microphone access was blocked. Allow the microphone for this site and try again.");
    }
  }

  function stop() {
    setRecording(false);
    recorder.current?.stop();
    cleanup();
  }

  /** The recording is over: transcribe it and save it as a note. */
  async function finish(blob: Blob) {
    const length = seconds0.current;
    try {
      setWorking("transcribing");
      const { chunks: parts, raw } = await toWavChunks(blob);
      const form = new FormData();
      parts.forEach((c, i) => form.append("audio", c, raw ? "consultation.webm" : `part-${i + 1}.wav`));
      form.append("language", "unknown");
      const res = await fetch("/api/scribe/transcribe", { method: "POST", body: form, credentials: "same-origin" });
      if (!res.ok) throw new Error("transcribe");
      const json = (await res.json()) as { data: { transcript: string; language: string; reason?: string; detail?: string } };
      const transcript = (json.data.transcript ?? "").trim();
      if (json.data.reason === "api-error") { setError(`${json.data.detail ?? "The recording couldn't be processed."} Nothing was saved. Please try again.`); return; }
      if (!transcript) { setError("No speech was heard. Nothing was saved. Please try again."); return; }
      setWorking("saving");
      await api.post("/scribe", {
        appointmentId, patientId: patientId ?? undefined, patientName, doctorId: doctorId ?? undefined, doctorName,
        transcript, brief: "", language: json.data.language || "en-IN", durationSec: length, status: "Saved",
      });
      setDone(`Saved · ${fmt(length)}. See it in the Consultation Scribe section below.`);
      onSaved();
    } catch {
      setError("Couldn't transcribe or save the recording. Please try again.");
    } finally {
      setWorking("");
    }
  }

  const busy = working !== "";

  return (
    <div className={`rounded-[14px] border p-5 flex flex-col gap-3 self-stretch transition-colors ${recording ? "border-[#ffb3b5] bg-[#fff6f6]" : "border-[color:var(--line)] bg-[color:var(--surface)]"}`} data-testid="quick-scribe">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-[8px] bg-[color:var(--brand-soft)] flex items-center justify-center"><Sparkles size={16} className="text-[color:var(--brand)]" strokeWidth={1.75} /></div>
        <div>
          <div className="text-[14px] font-medium text-[color:var(--ink)]">KAYA AI Scribe</div>
          <div className="text-[11px] font-light text-[color:var(--ink-soft)]">Speak any Indian language</div>
        </div>
      </div>

      {/* Voice level */}
      <div className="flex h-[44px] items-center justify-center gap-[3px]" aria-hidden={!recording}>
        {levels.map((l, i) => (
          <span key={i} className={`w-[4px] rounded-full transition-[height] duration-75 ${recording ? "bg-[#ff0004]" : "bg-[color:var(--line)]"}`} style={{ height: `${Math.round(l * 100)}%` }} />
        ))}
      </div>

      {recording ? (
        <>
          <p className="flex items-center justify-center gap-2 text-[12px] text-[#c8001a]" role="status"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#ff0004]" /> Listening… {fmt(seconds)}</p>
          <button onClick={stop} aria-label="Stop scribing" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ff0004] px-4 py-2 text-[13px] text-white cursor-pointer"><Square size={13} /> Stop scribing</button>
        </>
      ) : (
        <button onClick={start} disabled={busy} aria-label="Start scribing" className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--brand)] px-4 py-2 text-[13px] text-white hover:bg-[color:var(--brand-hover)] disabled:opacity-50 cursor-pointer">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />} {working === "transcribing" ? "Transcribing…" : working === "saving" ? "Saving…" : "Start scribing"}
        </button>
      )}

      {done && <p role="status" className="flex items-start gap-2 text-[12px] text-[#0b7a47]"><CheckCircle2 size={14} className="mt-[1px] shrink-0" /> {done}</p>}
      {error && <p role="alert" className="rounded-[8px] bg-[#ffe9e9] px-3 py-2 text-[12px] text-[#c8001a]">{error}</p>}
    </div>
  );
}
