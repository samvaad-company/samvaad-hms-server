/**
 * Gemini AI integration for the platform-wide AI Chat assistant.
 *
 * Exposes a single streaming chat-completion call with function calling
 * (tool use), so the chat service can let the model decide which scoped data
 * lookup(s) it needs before answering. When GEMINI_API_KEY is not configured
 * the module runs in MOCK mode and yields a single explanatory text chunk, so
 * the chat UI is fully usable/demoable with zero setup — mirroring the
 * mock/live fallback convention also used by gemini-scribe.ts.
 */
import { getConfig } from "@/config/env";
import { logger } from "@/lib/logger";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiLive(): boolean {
  return Boolean(getConfig().geminiApiKey);
}

export type GeminiRole = "user" | "model";

export type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

export interface GeminiContent {
  role: GeminiRole;
  parts: GeminiPart[];
}

export interface ToolDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "OBJECT";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type GeminiStreamChunk =
  | { type: "text"; delta: string }
  | { type: "functionCall"; name: string; args: Record<string, unknown>; thoughtSignature?: string }
  | { type: "error"; detail: string };

/**
 * Stream one Gemini turn. Yields text deltas as they arrive, or a single
 * functionCall chunk if the model decides to call a tool instead of
 * answering directly (Gemini returns a functionCall part as one complete
 * chunk, not incrementally, so no special buffering is needed).
 */
export async function* streamGenerateContent(input: {
  systemInstruction: string;
  contents: GeminiContent[];
  tools: ToolDeclaration[];
}): AsyncGenerator<GeminiStreamChunk> {
  const { geminiApiKey: key, geminiModel } = getConfig();
  if (!key) {
    yield {
      type: "text",
      delta:
        "AI Chat is running in demo mode — no GEMINI_API_KEY is configured. " +
        "Ask your platform admin to set one in the environment to enable live answers grounded in this hospital's data.",
    };
    return;
  }

  const url = `${API_BASE}/${geminiModel}:streamGenerateContent?alt=sse&key=${key}`;
  const body = {
    systemInstruction: { role: "user" as const, parts: [{ text: input.systemInstruction }] },
    contents: input.contents,
    ...(input.tools.length > 0
      ? { tools: [{ functionDeclarations: input.tools }] }
      : {}),
    generationConfig: { temperature: 0.3 },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    logger.warn("gemini.fetch.fallback", { error: String(err) });
    yield { type: "error", detail: `Could not reach Gemini: ${String(err)}` };
    return;
  }

  if (!res.ok || !res.body) {
    const detail = await safeText(res);
    logger.warn("gemini.stream.error", { status: res.status, detail });
    yield { type: "error", detail: `Gemini error ${res.status}: ${detail}` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let yieldedAny = false;
  let lastFinishReason: string | undefined;
  let rawSeen = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // Gemini's SSE stream uses CRLF line endings — normalize to LF so the
    // "\n\n" event-boundary split below actually matches.
    const decoded = decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    buffer += decoded;
    rawSeen += decoded;

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);
      for (const line of rawEvent.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        lastFinishReason = finishReasonOf(payload) ?? lastFinishReason;
        for (const chunk of partsFromChunk(payload)) {
          yieldedAny = true;
          yield chunk;
        }
      }
    }
  }

  // Gemini can return a 200 with zero parts (e.g. blocked by a safety filter,
  // or a finishReason other than STOP with nothing to say) — surface that
  // instead of silently producing an empty reply with no explanation.
  if (!yieldedAny) {
    logger.warn("gemini.stream.empty", { finishReason: lastFinishReason, raw: rawSeen.slice(0, 2000) });
    yield {
      type: "error",
      detail:
        lastFinishReason && lastFinishReason !== "STOP"
          ? `Gemini stopped without answering (reason: ${lastFinishReason}).`
          : "Gemini returned an empty response.",
    };
  }
}

function finishReasonOf(payload: string): string | undefined {
  try {
    const json = JSON.parse(payload) as { candidates?: { finishReason?: string }[] };
    return json.candidates?.[0]?.finishReason;
  } catch {
    return undefined;
  }
}

function* partsFromChunk(payload: string): Generator<GeminiStreamChunk> {
  let json: {
    candidates?: { content?: { parts?: Record<string, unknown>[] } }[];
    error?: { message?: string };
  };
  try {
    json = JSON.parse(payload);
  } catch {
    return;
  }
  if (json.error) {
    yield { type: "error", detail: json.error.message ?? "Unknown Gemini error" };
    return;
  }
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (typeof part.text === "string" && part.text !== "") {
      yield { type: "text", delta: part.text };
    } else if (part.functionCall && typeof part.functionCall === "object") {
      const fc = part.functionCall as { name: string; args?: Record<string, unknown> };
      const thoughtSignature = typeof part.thoughtSignature === "string" ? part.thoughtSignature : undefined;
      yield { type: "functionCall", name: fc.name, args: fc.args ?? {}, thoughtSignature };
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
