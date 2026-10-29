import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { returnDispense } from "@/services/dispense-service";

/** { lines: [{ lineId, quantity, condition: "Usable" | "Damaged" | "Expired" }], reason? } */
export const POST = actionRoute("pharmacy", "write", async (req, ctx, session) =>
  ok(await returnDispense(parseId((await ctx.params).id), await readJson(req), session)));
