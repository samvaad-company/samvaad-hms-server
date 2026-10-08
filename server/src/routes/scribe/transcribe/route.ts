/**
 * Speech-to-text for consultation scribing, via Gemini.
 *
 * Accepts one or more audio clips in the multipart field "audio" (the client
 * splits long recordings into ≤28s WAV chunks so the transcript keeps
 * streaming in live as the doctor talks). Chunks are transcribed in order
 * and stitched back into a single transcript.
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { transcribe, type FallbackReason } from "@/services/gemini-scribe";

export const POST = withRoute(async (req: ApiRequest) => {
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
