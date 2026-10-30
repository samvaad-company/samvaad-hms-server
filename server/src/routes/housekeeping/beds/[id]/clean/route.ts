import { created } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { cleanBed } from "@/services/housekeeping-service";

/** Send a free bed for cleaning. */
export const POST = actionRoute("beds", "write", async (_req, ctx, session) => created(await cleanBed(parseId((await ctx.params).id), session)));
