import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getAiMonitor } from "@/services/ai-monitor-service";

/** ?days=7|30|90 — use of the scribe, the AI chat and the WhatsApp bot. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("reports", "read");
  return ok(await getAiMonitor(Number(new URL(req.url).searchParams.get("days")), session));
});
