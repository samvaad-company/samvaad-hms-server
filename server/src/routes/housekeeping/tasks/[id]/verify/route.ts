import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { verifyTask } from "@/services/housekeeping-service";

export const POST = actionRoute("beds", "write", async (req, ctx, session) => ok(await verifyTask(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session)));
