/**
 * Reports whether the Gemini integration is configured, so the scribe panel
 * can show "live" vs "demo mode" before the doctor starts recording.
 * Never exposes the key itself.
 */
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { isGeminiScribeLive } from "@/server/services/gemini-scribe";

export const GET = withRoute(async () => {
  await requirePermission("scribe", "read");
  return ok({ live: isGeminiScribeLive() });
});
