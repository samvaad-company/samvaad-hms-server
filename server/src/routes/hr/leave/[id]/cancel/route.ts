import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cancelLeave } from "@/services/hr-leave-service";

export const POST = actionRoute("hr", "write", async (_req, ctx, session) =>
  ok(await cancelLeave(parseId((await ctx.params).id), session)));
