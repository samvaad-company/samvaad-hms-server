/**
 * Gemini AI integration for consultation scribing (replaces the earlier
 * Sarvam-based integration — same external contract so the routes and UI
 * barely had to change).
 *
 * Two capabilities are exposed:
 *   - transcribe(): speech-to-text over a recorded audio clip, via Gemini's
 *     multimodal generateContent (inline audio input). The model is asked to
 *     return strict JSON ({ language, transcript }) so callers get the same
 *     shape the old Sarvam integration returned. Language is auto-detected,
 *     so Hindi, Gujarati, Marathi, Tamil, Bengali, English and other Indic
 *     languages all work without the doctor selecting anything — the
 *     transcript comes back in the spoken language's native script.
 *   - summarizeBrief(): turns a raw transcript (in any of those languages)
 *     into a structured SOAP brief, always written in English.
 *
 * Reuses the same GEMINI_API_KEY / GEMINI_MODEL already configured for AI
 * Chat — no separate setup needed. When the key is not configured the
 * module runs in MOCK mode and returns deterministic sample output, so the
 * feature stays usable in the default demo. Every result reports `mock`
 * plus a `reason`, so the UI can tell "no key configured" apart from "the
 * live call failed".
 */
import { getConfig } from "@/config/env";
import { logger } from "@/lib/logger";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** Why a result came back from the mock path instead of the live API. */
export type FallbackReason = "live" | "no-key" | "api-error";

export interface TranscriptionResult {
  transcript: string;
  language: string;
  mock: boolean;
  reason: FallbackReason;
  /** Human-readable detail when reason === "api-error". */
  detail?: string;
}

export interface BriefResult {
  brief: string;
  mock: boolean;
  reason: FallbackReason;
  detail?: string;
}

export function isGeminiScribeLive(): boolean {
  return Boolean(getConfig().geminiApiKey);
}

/**
 * Speech-to-text over one audio clip. The client chunks longer recordings
 * (≤28s each) so the "live transcript as you record" UX keeps working, but
 * Gemini itself has no such hard limit — this is purely for responsiveness.
 * `languageCode` is currently unused for the request (Gemini auto-detects)
 * and only kept as the fallback value if detection is inconclusive.
 */
export async function transcribe(
  audio: Blob,
  languageCode = "unknown",
): Promise<TranscriptionResult> {
  const { geminiApiKey: key, geminiModel } = getConfig();
  if (!key) return { ...mockTranscription(), reason: "no-key" as const };

  const mimeType = audio.type || "audio/wav";
  let base64: string;
  try {
    base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");
  } catch (err) {
    return {
      transcript: "",
      language: languageCode,
      mock: true,
      reason: "api-error",
      detail: `Could not read the recorded audio: ${String(err)}`,
    };
  }

  const url = `${API_BASE}/${geminiModel}:generateContent?key=${key}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "Transcribe this consultation audio clip verbatim, in whatever language is actually " +
              "spoken (do not translate). Respond with ONLY a JSON object of this exact shape: " +
              '{"language": "<BCP-47 code, e.g. hi-IN, en-IN, gu-IN>", "transcript": "<verbatim transcript, ' +
              'original script>"}. If there is no discernible speech, respond with ' +
              '{"language": "unknown", "transcript": ""}. No commentary, no markdown, no code fences.',
          },
          { inlineData: { mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, responseMimeType: "application/json" },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await safeText(res);
      logger.warn("gemini.scribe.stt.error", { status: res.status, detail });
      // Never fabricate clinical content when the doctor expects a real
      // transcription — return empty and let the UI surface the failure.
      return {
        transcript: "",
        language: languageCode,
        mock: true,
        reason: "api-error",
        detail: humanizeError(res.status, detail),
      };
    }
    const text = extractText(await res.json());
    if (!text) {
      return {
        transcript: "",
        language: languageCode,
        mock: true,
        reason: "api-error",
        detail: "Gemini returned an empty transcription.",
      };
    }
    const parsed = parseJsonLoose<{ language?: string; transcript?: string }>(text);
    logger.info("gemini.scribe.stt.ok", { language: parsed?.language });
    return {
      transcript: (parsed?.transcript ?? "").trim(),
      language: parsed?.language ?? languageCode,
      mock: false,
      reason: "live",
    };
  } catch (err) {
    logger.warn("gemini.scribe.stt.fallback", { error: String(err) });
    return {
      transcript: "",
      language: languageCode,
      mock: true,
      reason: "api-error",
      detail: `Could not reach Gemini: ${String(err)}`,
    };
  }
}

/** Turn a raw Gemini error into something a clinician can act on. */
function humanizeError(status: number, detail: string): string {
  if (status === 401 || status === 403) {
    return "Gemini rejected the API key. Check GEMINI_API_KEY.";
  }
  if (status === 429) {
    return "Gemini rate limit reached. Please retry in a moment.";
  }
  if (status === 400 && /audio|mime|format|decode/i.test(detail)) {
    return "Gemini could not decode the audio format.";
  }
  return `Gemini error ${status}.`;
}

/**
 * Summarize a transcript into a structured SOAP brief. The transcript may be in
 * any supported language; the brief is always returned in English.
 */
export async function summarizeBrief(transcript: string): Promise<BriefResult> {
  const clean = transcript.trim();
  if (!clean) {
    return { brief: "", mock: !isGeminiScribeLive(), reason: isGeminiScribeLive() ? "live" : "no-key" };
  }

  const { geminiApiKey: key, geminiModel } = getConfig();
  if (!key) return { brief: heuristicBrief(clean), mock: true, reason: "no-key" };

  const url = `${API_BASE}/${geminiModel}:generateContent?key=${key}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              "You are a medical scribe that writes SOAP notes in ENGLISH ONLY. " +
              "The dictation you receive may be in Hindi, Gujarati, Marathi, Tamil, Bengali, English or a mix — " +
              "you must TRANSLATE it and output English. Never reply in Hindi, Gujarati or any non-English language, " +
              "and never use Devanagari or any non-Latin script. " +
              "Output exactly four lines in this plain-text format, with no markdown, bold, or extra commentary:\n" +
              "S: <subjective>\nO: <objective>\nA: <assessment>\nP: <plan>\n" +
              "Preserve drug names, dosages and numbers exactly. Use short clinical phrasing.\n\n" +
              `Dictation:\n${clean}\n\n` +
              "Write the SOAP note now. Remember: the output must be entirely in English (Latin script), " +
              "translated from the dictation, in the four-line S/O/A/P plain-text format.",
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.2 },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await safeText(res);
      logger.warn("gemini.scribe.brief.error", { status: res.status, detail });
      return {
        brief: heuristicBrief(clean),
        mock: true,
        reason: "api-error",
        detail: `Gemini error ${res.status}: ${detail}`,
      };
    }
    const brief = extractText(await res.json()).trim();
    if (!brief) {
      return { brief: heuristicBrief(clean), mock: true, reason: "api-error", detail: "Empty response" };
    }
    logger.info("gemini.scribe.brief.ok", {});
    return { brief, mock: false, reason: "live" };
  } catch (err) {
    logger.warn("gemini.scribe.brief.fallback", { error: String(err) });
    return {
      brief: heuristicBrief(clean),
      mock: true,
      reason: "api-error",
      detail: String(err),
    };
  }
}

// ── Gemini response helpers ─────────────────────────────────────────────────

function extractText(json: unknown): string {
  const j = json as { candidates?: { content?: { parts?: { text?: string }[] } }[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Unknown Gemini error");
  return (j.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
}

/** Gemini's JSON mode occasionally wraps the object in a code fence anyway. */
function parseJsonLoose<T>(text: string): T | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

const MOCK_TRANSCRIPTS = [
  "Patient presents with fever and body ache for the last two days. Temperature recorded at 100.8 Fahrenheit. Throat mildly congested, no rash. Advised paracetamol six hourly, plenty of fluids, and rest. Review after three days if symptoms persist.",
  "Patient reports persistent cough with mild breathlessness on exertion. No fever. Chest clear on auscultation, oxygen saturation 97 percent. Started on a bronchodilator inhaler and advised a chest x-ray if no improvement in five days.",
  "Follow-up for hypertension. Home readings averaging 140 over 90. Currently on amlodipine 5 milligrams. Advised to increase to 10 milligrams once daily, reduce salt intake, and continue daily walking. Recheck blood pressure in two weeks.",
];

function mockTranscription(): Omit<TranscriptionResult, "reason"> {
  const transcript =
    MOCK_TRANSCRIPTS[Math.floor(Math.random() * MOCK_TRANSCRIPTS.length)];
  return { transcript, language: "en-IN", mock: true };
}

/** Lightweight local SOAP summary used when the Gemini API is unavailable. */
function heuristicBrief(transcript: string): string {
  const sentences = transcript
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const subjective = sentences.slice(0, 2).join(" ") || transcript;
  const objective =
    sentences.find((s) => /temperature|bp|pulse|saturation|clear|examination|recorded/i.test(s)) ??
    "See subjective.";
  const plan =
    sentences.find((s) => /advis|start|review|recheck|continue|increase|refer/i.test(s)) ??
    "Plan as discussed.";
  return [
    `S: ${subjective}`,
    `O: ${objective}`,
    `A: Clinical impression per dictation.`,
    `P: ${plan}`,
  ].join("\n");
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
