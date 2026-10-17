import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { tickChecklist } from "@/services/checklists-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("nursing", "write");
  const body = await readJson(req).catch(() => ({}));
  return ok(await tickChecklist(parseId((await ctx.params).id), body, session));
});
