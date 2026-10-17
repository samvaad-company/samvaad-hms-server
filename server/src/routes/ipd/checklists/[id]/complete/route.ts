import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { completeChecklist } from "@/services/checklists-service";

export const POST = actionRoute("nursing", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await completeChecklist(parseId(id), session));
});
