import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { arriveAtScene } from "@/services/ambulance-service";

/** Dispatched → At scene. */
export const POST = actionRoute("ambulance", "write", async (_req, ctx, session) => ok(await arriveAtScene(parseId((await ctx.params).id), session)));
