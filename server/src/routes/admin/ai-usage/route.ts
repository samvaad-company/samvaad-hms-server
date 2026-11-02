/**
 * AI token usage for the super admin dashboard: who used how much this month, against which limit.
 * `?month=YYYY-MM` looks at an earlier month. Only a super admin may read it (checked in the service).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { getUsageReport } from "@/services/ai-quota-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  const month = new URL(req.url, "http://localhost").searchParams.get("month");
  return ok(await getUsageReport(month, session));
});
