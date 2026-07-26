/**
 * Speech-to-text for consultation scribing.
 *
 * Accepts one or more audio clips in the multipart field "audio" (the client
 * splits long recordings into ≤30s WAV chunks, since Sarvam's synchronous STT
 * endpoint rejects longer clips). Chunks are transcribed in order and stitched
 * back into a single transcript.
 */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { BadRequestError } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/server";
import { transcribe, type FallbackReason } from "@/server/services/sarvam";

export const POST = withRoute(async (req: NextRequest) => {
  await requirePermission("scribe", "write");
  const form = await req.formData();
  const clips = form.getAll("audio").filter((v): v is File => v instanceof Blob);
  const language = (form.get("language") as string) || "unknown";
  if (clips.length === 0) {
    throw new BadRequestError("Missing audio clip");
  }

  const parts: string[] = [];
  let detectedLanguage = language;
  let anyMock = false;
  let reason: FallbackReason = "live";
  let detail: string | undefined;

  for (const clip of clips) {
    const result = await transcribe(clip, language);
    if (result.transcript) parts.push(result.transcript);
    if (result.language && result.language !== "unknown") {
      detectedLanguage = result.language;
    }
    if (result.mock) {
      anyMock = true;
      // Surface the first real failure; "no-key" is the baseline demo state.
      if (result.reason === "api-error" && reason !== "api-error") {
        reason = "api-error";
        detail = result.detail;
      } else if (reason === "live") {
        reason = result.reason;
      }
    }
  }

  return ok({
    transcript: parts.join(" ").trim(),
    language: detectedLanguage,
    mock: anyMock,
    reason,
    detail,
    chunks: clips.length,
  });
});
