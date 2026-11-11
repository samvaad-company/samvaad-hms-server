import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { recordOpdVitals, listOpdVitals } from "@/services/opd-service";

type Ctx = { params: Promise<{ id: string }> };

/** Every set of vitals taken at this visit, newest first. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("opd", "read");
  return ok(await listOpdVitals(parseId((await ctx.params).id), session));
});

/** Adds a new set of vitals to the visit. It can be done as often as needed; earlier readings are kept. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("opd", "add");
  return created(await recordOpdVitals(parseId((await ctx.params).id), await readJson(req), session));
});
