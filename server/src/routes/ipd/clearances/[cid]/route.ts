/** POST { decision: "Cleared" | "Flagged", amountDue?, note? } — a department answers a discharge request. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { requireSession } from "@/auth/server";
import { parseId } from "@/http/crud";
import { respondToClearance } from "@/services/ipd-clearance-service";

// The department's own permission is checked in the service; the IPD permission is not needed to answer.
export const POST = withRoute(async (req, ctx: { params: Promise<{ cid: string }> }) => {
  const session = await requireSession();
  return ok(await respondToClearance(parseId((await ctx.params).cid), await readJson(req), session));
});
