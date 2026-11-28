/** The month's cost: Gemini by feature, WhatsApp templates, Razorpay fees and the bills an admin entered. `?month=YYYY-MM`. Super admin and admin only. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { costReport } from "@/services/ai-budget-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  return ok(await costReport(new URL(req.url, "http://localhost").searchParams.get("month"), session));
});
