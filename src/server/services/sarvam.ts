/**
 * Sarvam AI integration for consultation scribing.
 *
 * Two capabilities are exposed:
 *   - transcribe(): speech-to-text over a recorded audio clip (Saarika ASR).
 *     Language is auto-detected, so Hindi, Gujarati, Marathi, Tamil, Bengali,
 *     English and the other supported Indic languages all work without the
 *     doctor selecting anything. The transcript comes back in the spoken
 *     language's native script.
 *   - summarizeBrief(): turns a raw transcript (in any of those languages) into
 *     a structured SOAP brief, always written in English.
 *
 * When SARVAM_API_KEY is not configured the module runs in MOCK mode and
 * returns deterministic sample output, so the feature is usable in the default
 * demo. Every result reports `mock` plus a `reason`, so the UI can tell the
 * difference between "no key configured" and "the live call failed".
 */
import { getConfig } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const STT_MODEL = "saarika:v2.5";
// `sarvam-m` was deprecated by Sarvam; the current chat models are
// sarvam-30b (fast) and sarvam-105b (most capable).
const CHAT_MODEL = process.env.SARVAM_CHAT_MODEL ?? "sarvam-105b";

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

export function isSarvamLive(): boolean {
  return Boolean(getConfig().sarvamApiKey);
}

/**
 * Speech-to-text over one audio clip (≤30s — the caller chunks longer
 * recordings). `languageCode` defaults to "unknown" for auto-detection.
 */
export async function transcribe(
  audio: Blob,
  languageCode = "unknown",
): Promise<TranscriptionResult> {
  const key = getConfig().sarvamApiKey;
  if (!key) return { ...mockTranscription(), reason: "no-key" as const };

  // Sarvam expects WAV/MP3; the client converts webm → wav before upload.
  const isWav = audio.type.includes("wav");
  const form = new FormData();
  form.append("file", audio, isWav ? "consultation.wav" : "consultation.webm");
  form.append("model", STT_MODEL);
  form.append("language_code", languageCode);

  try {
    const res = await fetch(STT_URL, {
      method: "POST",
      headers: { "api-subscription-key": key },
      body: form,
    });
    if (!res.ok) {
      const detail = await safeText(res);
      logger.warn("sarvam.stt.error", { status: res.status, detail });
      // Never fabricate clinical content when the doctor expects a real
      // transcription — return empty and let the UI surface the failure.
      return {
        transcript: "",
        language: languageCode,
        mock: true,
        reason: "api-error",
        detail: humanizeSttError(res.status, detail),
      };
    }
    const json = (await res.json()) as {
      transcript?: string;
      text?: string;
      language_code?: string;
    };
    logger.info("sarvam.stt.ok", { language: json.language_code });
    return {
      transcript: (json.transcript ?? json.text ?? "").trim(),
      language: json.language_code ?? languageCode,
      mock: false,
      reason: "live",
    };
  } catch (err) {
    logger.warn("sarvam.stt.fallback", { error: String(err) });
    return {
      transcript: "",
      language: languageCode,
      mock: true,
      reason: "api-error",
      detail: `Could not reach Sarvam: ${String(err)}`,
    };
  }
}

/** Turn a raw Sarvam STT error into something a clinician can act on. */
function humanizeSttError(status: number, detail: string): string {
  if (detail.includes("exceeds the maximum limit")) {
    return "Recording segment was too long for Sarvam (30s limit).";
  }
  if (status === 401 || status === 403) {
    return "Sarvam rejected the API key. Check SARVAM_API_KEY.";
  }
  if (status === 429) {
    return "Sarvam rate limit reached. Please retry in a moment.";
  }
  if (status === 400 && /format|codec|decode|audio/i.test(detail)) {
    return "Sarvam could not decode the audio format.";
  }
  return `Sarvam error ${status}.`;
}

/**
 * Summarize a transcript into a structured SOAP brief. The transcript may be in
 * any supported language; the brief is always returned in English.
 */
export async function summarizeBrief(transcript: string): Promise<BriefResult> {
  const clean = transcript.trim();
  if (!clean) {
    return { brief: "", mock: !isSarvamLive(), reason: isSarvamLive() ? "live" : "no-key" };
  }

  const key = getConfig().sarvamApiKey;
  if (!key) return { brief: heuristicBrief(clean), mock: true, reason: "no-key" };

  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "api-subscription-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a medical scribe that writes SOAP notes in ENGLISH ONLY. " +
              "The dictation you receive may be in Hindi, Gujarati, Marathi, Tamil, Bengali, English or a mix — " +
              "you must TRANSLATE it and output English. Never reply in Hindi, Gujarati or any non-English language, " +
              "and never use Devanagari or any non-Latin script. " +
              "Output exactly four lines in this plain-text format, with no markdown, bold, or extra commentary:\n" +
              "S: <subjective>\nO: <objective>\nA: <assessment>\nP: <plan>\n" +
              "Preserve drug names, dosages and numbers exactly. Use short clinical phrasing.",
          },
          {
            role: "user",
            content:
              `Dictation:\n${clean}\n\n` +
              "Write the SOAP note now. Remember: the output must be entirely in English (Latin script), " +
              "translated from the dictation, in the four-line S/O/A/P plain-text format.",
          },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const detail = await safeText(res);
      logger.warn("sarvam.chat.error", { status: res.status, detail });
      return {
        brief: heuristicBrief(clean),
        mock: true,
        reason: "api-error",
        detail: `Sarvam chat ${res.status}: ${detail}`,
      };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const brief = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!brief) {
      return { brief: heuristicBrief(clean), mock: true, reason: "api-error", detail: "Empty response" };
    }
    logger.info("sarvam.chat.ok", {});
    return { brief, mock: false, reason: "live" };
  } catch (err) {
    logger.warn("sarvam.chat.fallback", { error: String(err) });
    return {
      brief: heuristicBrief(clean),
      mock: true,
      reason: "api-error",
      detail: String(err),
    };
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

/** Lightweight local SOAP summary used when the Sarvam API is unavailable. */
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
