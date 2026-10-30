import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { resolveInfection } from "@/services/waste-ic-service";

export const POST = actionRoute("cssd", "write", async (_req, ctx, session) => ok(await resolveInfection(parseId((await ctx.params).id), session)));
