import { type ApiRequest } from "@/http/web";
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { cancelConsult } from "@/services/teleconsult-service";

/** Cancel a tele-consult; body `{ "refund": false }` skips returning the fee (default is to refund). */
export const POST = actionRoute("teleconsult", "write", async (req: ApiRequest, ctx, session) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await cancelConsult(parseId(id), body, session));
});
