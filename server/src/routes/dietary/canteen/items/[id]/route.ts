import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { updateCanteenItem } from "@/services/dietary-service";

/** { price?, active? } */
export const PATCH = actionRoute("ipd", "write", async (req, ctx, session) => ok(await updateCanteenItem(parseId((await ctx.params).id), await readJson(req), session)));
