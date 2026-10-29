import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { updateLeaveType } from "@/services/hr-leave-service";

export const PATCH = actionRoute("hr", "write", async (req, ctx, session) =>
  ok(await updateLeaveType(parseId((await ctx.params).id), await readJson(req), session)));
