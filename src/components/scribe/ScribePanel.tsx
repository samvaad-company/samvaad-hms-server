"use client";

/**
 * AI consultation scribe. While the patient is with the doctor, records the
 * dictation, transcribes it via Sarvam AI (mock fallback in demo mode), lets the
 * doctor edit, generate a structured SOAP brief, and save it against the
 * appointment.
 */
import { useEffect, useRef, useState } from "react";
import {
  Mic, Square, Loader2, Sparkles, Save, Trash2, FileText, Radio,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useList, useMutation } from "@/lib/api/hooks";
import type { ScribeNoteDTO } from "@/types/api";
import { StatusBadge } from "@/components/shared/StatusBadge";

interface ScribePanelProps {
  appointmentId: number;
  patientName: string;
  doctorName: string;
  doctorId?: number | null;
  patientId?: number | null;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ScribePanel({
  appointmentId, patientName, doctorName, doctorId, patientId,
}: ScribePanelProps) {
  const { items: allNotes, reload } = useList<ScribeNoteDTO>("/scribe", { all: true });
  const notes = allNotes.filter((n) => n.appointmentId === appointmentId);
  const { run, loading: saving } = useMutation();

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en-IN");
  const [transcribing, setTranscribing] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mock, setMock] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef = useRef(0);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        void sendForTranscription(blob, durationRef.current);
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      durationRef.current = 0;
      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setSeconds(durationRef.current);
      }, 1000);
    } catch {
      setError("Microphone access was blocked. You can type notes manually below.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
    recorderRef.current?.stop();
  }

  async function sendForTranscription(blob: Blob, duration: number) {
    setTranscribing(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("audio", blob, "consultation.webm");
      form.append("language", "unknown");
      const res = await fetch("/api/scribe/transcribe", {
        method: "POST",
        body: form,
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Transcription failed");
      const json = (await res.json()) as {
        data: { transcript: string; language: string; mock: boolean };
      };
      const text = json.data.transcript;
      setTranscript((prev) => (prev ? `${prev} ${text}` : text));
      setLanguage(json.data.language || "en-IN");
      setMock(json.data.mock);
      durationRef.current = duration;
    } catch {
      setError("Could not transcribe the recording. Please try again or type notes.");
    } finally {
      setTranscribing(false);
    }
  }

  async function generateBrief() {
    if (!transcript.trim()) return;
    setBriefing(true);
    setError(null);
    try {
      const data = await api.post<{ brief: string; mock: boolean }>("/scribe/brief", {
        transcript,
      });
      setBrief(data.brief);
      setMock(data.mock);
    } catch {
      setError("Could not generate a brief.");
    } finally {
      setBriefing(false);
    }
  }

  async function save() {
    if (!transcript.trim()) return;
    await run(() =>
      api.post("/scribe", {
        appointmentId,
        patientId: patientId ?? undefined,
        patientName,
        doctorId: doctorId ?? undefined,
        doctorName,
        transcript,
        brief,
        language,
        durationSec: durationRef.current,
        status: "Saved",
      }),
    );
    setTranscript("");
    setBrief("");
    setSeconds(0);
    durationRef.current = 0;
    reload();
  }

  async function remove(id: number) {
    await run(() => api.del(`/scribe/${id}`));
    reload();
  }

  const btn = "text-[13px] font-normal px-4 py-2 rounded-full transition-colors inline-flex items-center gap-2 disabled:opacity-50";

  return (
    <div className="bg-white border border-[#dedee1] rounded-[14px] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[8px] bg-[#e8f7f7] flex items-center justify-center">
            <Sparkles size={16} className="text-[#009598]" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-[14px] font-medium text-[#11111c]">AI Consultation Scribe</div>
            <div className="text-[11px] font-light text-[#57575f]">
              Powered by Sarvam AI{mock ? " · demo mode (mock transcript)" : ""}
            </div>
          </div>
        </div>
        {recording ? (
          <button onClick={stopRecording} className={`${btn} bg-[#ff0004] text-white`}>
            <Square size={13} /> Stop · {fmtDuration(seconds)}
          </button>
        ) : (
          <button onClick={startRecording} disabled={transcribing} className={`${btn} bg-[#009598] text-white hover:bg-[#007f82]`}>
            <Mic size={14} /> Start Scribing
          </button>
        )}
      </div>

      {recording && (
        <div className="flex items-center gap-2 mb-3 text-[12px] text-[#ff0004]">
          <Radio size={13} className="animate-pulse" /> Recording… speak the consultation notes.
        </div>
      )}
      {transcribing && (
        <div className="flex items-center gap-2 mb-3 text-[12px] text-[#57575f]">
          <Loader2 size={13} className="animate-spin" /> Transcribing with Sarvam…
        </div>
      )}
      {error && (
        <div className="mb-3 text-[12px] text-[#ff0004] bg-[#ffe9e9] rounded-[8px] px-3 py-2">{error}</div>
      )}

      {/* Transcript */}
      <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Transcript</label>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Record or type the consultation notes here…"
        className="w-full mt-1 mb-3 min-h-[120px] text-[13px] text-[#11111c] border border-[#dedee1] rounded-[10px] p-3 outline-none focus:border-[#009598] resize-y"
      />

      {/* Brief */}
      {brief && (
        <>
          <label className="text-[11px] font-medium text-[#57575f] uppercase tracking-wider">Structured Brief (SOAP)</label>
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            className="w-full mt-1 mb-3 min-h-[110px] text-[13px] text-[#11111c] bg-[#f9fdfd] border border-[#dedee1] rounded-[10px] p-3 outline-none focus:border-[#009598] resize-y font-mono"
          />
        </>
      )}

      <div className="flex items-center gap-2">
        <button onClick={generateBrief} disabled={!transcript.trim() || briefing} className={`${btn} border border-[#dedee1] text-[#57575f] hover:bg-[#f6f6f6]`}>
          {briefing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generate Brief
        </button>
        <button onClick={save} disabled={!transcript.trim() || saving} className={`${btn} bg-[#009598] text-white hover:bg-[#007f82]`}>
          <Save size={14} /> Save Note
        </button>
      </div>

      {/* Saved notes */}
      {notes.length > 0 && (
        <div className="mt-6 border-t border-[#f0f0f0] pt-4">
          <div className="text-[12px] font-medium text-[#57575f] uppercase tracking-wider mb-3">
            Saved Notes ({notes.length})
          </div>
          <div className="flex flex-col gap-3">
            {notes.map((n) => (
              <div key={n.id} className="border border-[#dedee1] rounded-[10px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-[12px] text-[#57575f]">
                    <FileText size={13} /> {n.doctorName} · {fmtDuration(n.durationSec)} · {n.language}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={n.status} />
                    <button onClick={() => remove(n.id)} className="text-[#57575f] hover:text-[#ff0004] transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <p className="text-[13px] text-[#11111c] whitespace-pre-wrap">{n.transcript}</p>
                {n.brief && (
                  <pre className="mt-2 text-[12px] text-[#57575f] whitespace-pre-wrap bg-[#f9fdfd] rounded-[8px] p-3 font-mono">{n.brief}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
