import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { listPatientVitals } from "@/services/opd-service";

type Ctx = { params: Promise<{ id: string }> };

/** All the vitals taken for this patient across their OPD visits, newest first. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("opd", "read");
  return ok(await listPatientVitals(parseId((await ctx.params).id), session));
});
