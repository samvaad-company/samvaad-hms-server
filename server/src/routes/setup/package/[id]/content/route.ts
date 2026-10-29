import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { savePackageContent } from "@/services/setup-service";

/** { inclusions, exclusions, orderingRules } — replaces all three together. */
export const PUT = actionRoute("admin", "write", async (req, ctx, session) =>
  ok(await savePackageContent(parseId((await ctx.params).id), await readJson(req), session)));
