import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey } from "@/auth/portal";
import { parseId } from "@/http/crud";
import { verifyPortalPayment } from "@/services/teleconsult-service";

/** Patient app: report a completed checkout. Verifies the gateway signature, then confirms the booking. */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await verifyPortalPayment(parseId(id), body));
});
