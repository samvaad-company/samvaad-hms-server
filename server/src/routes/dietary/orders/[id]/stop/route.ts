import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { stopOrder } from "@/services/dietary-service";

export const POST = actionRoute("ipd", "write", async (_req, ctx, session) => ok(await stopOrder(parseId((await ctx.params).id), session)));
