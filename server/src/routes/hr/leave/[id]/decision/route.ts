import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { decideLeave } from "@/services/hr-leave-service";

/** { decision: "Approved" | "Rejected", note? } */
export const POST = actionRoute("hr", "write", async (req, ctx, session) =>
  ok(await decideLeave(parseId((await ctx.params).id), await readJson(req), session)));
