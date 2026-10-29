import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { recordReaction } from "@/services/bloodbank-flow-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("bloodbank", "write");
  const body = await readJson(req).catch(() => ({}));
  return ok(await recordReaction(parseId((await ctx.params).id), body, session));
});
