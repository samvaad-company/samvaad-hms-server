import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { updateDiet } from "@/services/dietary-service";

/** { name?, instructions?, meals?, active? } */
export const PATCH = actionRoute("ipd", "write", async (req, ctx, session) => ok(await updateDiet(parseId((await ctx.params).id), await readJson(req), session)));
