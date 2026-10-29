import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { getDispense } from "@/services/dispense-service";

export const GET = actionRoute("pharmacy", "read", async (_req, ctx, session) => ok(await getDispense(parseId((await ctx.params).id), session)));
