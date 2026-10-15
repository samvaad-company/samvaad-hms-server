import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { rescheduleFollowUp } from "@/services/followups-service";

export const POST = actionRoute("followups", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await rescheduleFollowUp(parseId(id), await readJson(req), session));
});
