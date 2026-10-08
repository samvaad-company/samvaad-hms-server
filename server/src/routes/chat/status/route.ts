/**
 * Reports whether the Gemini AI integration is configured, so the chat UI can
 * show "live" vs "demo mode". Never exposes the key itself.
 */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { isGeminiLive } from "@/services/gemini";

export const GET = withRoute(async () => {
  await requirePermission("chat", "read");
  return ok({ live: isGeminiLive() });
});
