/**
 * Reports whether the Gemini AI integration is configured, so the chat UI can
 * show "live" vs "demo mode", and the caller's token allowance for the month. Never exposes the key itself.
 */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { isGeminiLive } from "@/services/gemini";
import { getQuota } from "@/services/ai-quota-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("chat", "read");
  return ok({ live: isGeminiLive(), quota: await getQuota(session) });
});
