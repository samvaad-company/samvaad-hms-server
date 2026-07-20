/**
 * Sarvam AI integration for consultation scribing.
 *
 * Two capabilities are exposed:
 *   - transcribe(): speech-to-text over a recorded audio clip (Saarika ASR).
 *   - summarizeBrief(): turns a raw transcript into a structured SOAP brief
 *     using Sarvam's chat model.
 *
 * When SARVAM_API_KEY is not configured the module runs in MOCK mode and
 * returns deterministic sample output, so the feature is fully usable in the
 * default in-memory demo. Setting the key automatically switches to the live
 * Sarvam API — no code changes required.
 */
import { getConfig } from "@/server/config/env";
import { logger } from "@/server/lib/logger";

const STT_URL = "https://api.sarvam.ai/speech-to-text";
const CHAT_URL = "https://api.sarvam.ai/v1/chat/completions";
const STT_MODEL = "saarika:v2.5";
const CHAT_MODEL = "sarvam-m";

export interface TranscriptionResult {
  transcript: string;
  language: string;
  mock: boolean;
}

export interface BriefResult {
  brief: string;
  mock: boolean;
}

export function isSarvamLive(): boolean {
  return Boolean(getConfig().sarvamApiKey);
}

/** Speech-to-text over an audio clip. Falls back to a mock transcript. */
export async function transcribe(
  audio: Blob,
  languageCode = "unknown",
): Promise<TranscriptionResult> {
  const key = getConfig().sarvamApiKey;
  if (!key) return mockTranscription();

  const form = new FormData();
  form.append("file", audio, "consultation.webm");
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
      throw new Error(`Sarvam STT failed (${res.status})`);
    }
    const json = (await res.json()) as {
      transcript?: string;
      text?: string;
      language_code?: string;
    };
    return {
      transcript: (json.transcript ?? json.text ?? "").trim(),
      language: json.language_code ?? languageCode,
      mock: false,
    };
  } catch (err) {
    logger.warn("sarvam.stt.fallback", { error: String(err) });
    return mockTranscription();
  }
}

/** Summarize a transcript into a structured SOAP brief. Falls back to a local
 * heuristic summary. */
export async function summarizeBrief(transcript: string): Promise<BriefResult> {
  const clean = transcript.trim();
  if (!clean) return { brief: "", mock: !isSarvamLive() };

  const key = getConfig().sarvamApiKey;
  if (!key) return { brief: heuristicBrief(clean), mock: true };

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
              "You are a clinical scribe. Convert the doctor's dictation into a concise SOAP note with sections S (Subjective), O (Objective), A (Assessment), and P (Plan). Use short clinical phrasing. Return only the note.",
          },
          { role: "user", content: clean },
        ],
        temperature: 0.2,
      }),
    });
    if (!res.ok) {
      const detail = await safeText(res);
      logger.warn("sarvam.chat.error", { status: res.status, detail });
      throw new Error(`Sarvam chat failed (${res.status})`);
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const brief = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { brief: brief || heuristicBrief(clean), mock: false };
  } catch (err) {
    logger.warn("sarvam.chat.fallback", { error: String(err) });
    return { brief: heuristicBrief(clean), mock: true };
  }
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

const MOCK_TRANSCRIPTS = [
  "Patient presents with fever and body ache for the last two days. Temperature recorded at 100.8 Fahrenheit. Throat mildly congested, no rash. Advised paracetamol six hourly, plenty of fluids, and rest. Review after three days if symptoms persist.",
  "Patient reports persistent cough with mild breathlessness on exertion. No fever. Chest clear on auscultation, oxygen saturation 97 percent. Started on a bronchodilator inhaler and advised a chest x-ray if no improvement in five days.",
  "Follow-up for hypertension. Home readings averaging 140 over 90. Currently on amlodipine 5 milligrams. Advised to increase to 10 milligrams once daily, reduce salt intake, and continue daily walking. Recheck blood pressure in two weeks.",
];

function mockTranscription(): TranscriptionResult {
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
