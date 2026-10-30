import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cancelCall } from "@/services/ambulance-service";

export const POST = actionRoute("ambulance", "write", async (_req, ctx, session) => ok(await cancelCall(parseId((await ctx.params).id), session)));
