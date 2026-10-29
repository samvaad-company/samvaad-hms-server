import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { setRatePrices } from "@/services/setup-service";

/** { scope: "general" | "package" | "tpa", changes: [{ serviceId, price | null }] } */
export const PUT = actionRoute("admin", "write", async (req, ctx, session) =>
  ok(await setRatePrices(parseId((await ctx.params).id), await readJson(req), session)));
