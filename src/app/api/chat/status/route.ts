/**
 * Reports whether the Gemini AI integration is configured, so the chat UI can
 * show "live" vs "demo mode". Never exposes the key itself.
 */
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { isGeminiLive } from "@/server/services/gemini";

export const GET = withRoute(async () => {
  await requirePermission("chat", "read");
  return ok({ live: isGeminiLive() });
});
