/**
 * Streams a chat reply over SSE. Bypasses the JSON-envelope `api.*` client
 * (see client.ts) since the response body here is a live stream, not a
 * single JSON payload — the only endpoint in this app that needs that.
 */
import type { AiQuotaDTO } from "@/types/api";

export interface ChatDoneInfo {
  messageId: number;
  patientId: number | null;
  /** Tokens this answer used (all lookups included). */
  tokens: { in: number; out: number; total: number } | null;
  /** The person's allowance after this answer. */
  quota: AiQuotaDTO | null;
}

export interface ChatStreamHandlers {
  onTool?: (name: string) => void;
  onTextDelta: (delta: string) => void;
  onDone?: (info: ChatDoneInfo) => void;
  onError?: (message: string) => void;
}

export async function sendChatMessage(
  threadId: number,
  text: string,
  handlers: ChatStreamHandlers,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`/api/chat/threads/${threadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      credentials: "same-origin",
    });
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err.message : String(err));
    return;
  }

  if (!res.ok || !res.body) {
    handlers.onError?.(`Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIndex: number;
    while ((sepIndex = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIndex);
      buffer = buffer.slice(sepIndex + 2);

      let event = "message";
      let data = "";
      for (const line of rawEvent.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (!data) continue;

      try {
        const parsed = JSON.parse(data);
        if (event === "text") handlers.onTextDelta(parsed.delta ?? "");
        else if (event === "tool") handlers.onTool?.(parsed.name ?? "");
        else if (event === "done") handlers.onDone?.({ messageId: parsed.messageId, patientId: parsed.patientId ?? null, tokens: parsed.tokens ?? null, quota: parsed.quota ?? null });
      } catch {
        // Ignore malformed frames rather than breaking the stream.
      }
    }
  }
}
