/**
 * Speech-to-text for consultation scribing. Accepts a recorded audio clip
 * (multipart form field "audio") and returns the transcript via Sarvam AI,
 * or a mock transcript when no API key is configured.
 */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { BadRequestError } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/server";
import { transcribe } from "@/server/services/sarvam";

export const POST = withRoute(async (req: NextRequest) => {
  await requirePermission("scribe", "write");
  const form = await req.formData();
  const audio = form.get("audio");
  const language = (form.get("language") as string) || "unknown";
  if (!(audio instanceof Blob)) {
    throw new BadRequestError("Missing audio clip");
  }
  const result = await transcribe(audio, language);
  return ok(result);
});
