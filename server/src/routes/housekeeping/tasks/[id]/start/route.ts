import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { startTask } from "@/services/housekeeping-service";

/** Pending → In progress. */
export const POST = actionRoute("beds", "write", async (_req, ctx, session) => ok(await startTask(parseId((await ctx.params).id), session)));
