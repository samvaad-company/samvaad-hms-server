import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { BadRequestError } from "@/lib/errors";
import { actionRoute, parseId } from "@/http/crud";
import { addContractRule, removeContractRule } from "@/services/setup-service";

/** { kind: "copay" | "exclusion" | "limit" | "drg", rule: {…} } */
export const POST = actionRoute("admin", "write", async (req, ctx, session) =>
  created(await addContractRule(parseId((await ctx.params).id), await readJson(req), session)));

/** ?kind=copay&ruleId=… */
export const DELETE = actionRoute("admin", "write", async (req, ctx, session) => {
  const q = new URL(req.url).searchParams;
  const kind = q.get("kind"), ruleId = q.get("ruleId");
  if (!kind || !ruleId) throw new BadRequestError("kind and ruleId are required");
  return ok(await removeContractRule(parseId((await ctx.params).id), kind, ruleId, session));
});
