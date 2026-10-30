import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { dispatchCall } from "@/services/ambulance-service";

/** { ambulanceId } — give a queued call a vehicle (it must be available). */
export const POST = actionRoute("ambulance", "write", async (req, ctx, session) => ok(await dispatchCall(parseId((await ctx.params).id), await readJson(req), session)));
