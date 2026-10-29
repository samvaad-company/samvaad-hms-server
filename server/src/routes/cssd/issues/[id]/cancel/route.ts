import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cancelRequest } from "@/services/cssd-service";

export const POST = actionRoute("cssd", "write", async (_req, ctx, session) => {
  return ok(await cancelRequest(parseId((await ctx.params).id), session));
});
