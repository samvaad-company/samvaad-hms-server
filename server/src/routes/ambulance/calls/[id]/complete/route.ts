import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { completeCall } from "@/services/ambulance-service";

/** { amount? } — close the call, free the vehicle, bill the fare if there is one. */
export const POST = actionRoute("ambulance", "write", async (req, ctx, session) => ok(await completeCall(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session)));
