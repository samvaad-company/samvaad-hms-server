import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { updateShift } from "@/services/hr-roster-service";

export const PATCH = actionRoute("hr", "write", async (req, ctx, session) =>
  ok(await updateShift(parseId((await ctx.params).id), await readJson(req), session)));
