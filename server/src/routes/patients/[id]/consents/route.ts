import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { listPatientConsents, makeConsent } from "@/services/consents-service";

type Ctx = { params: Promise<{ id: string }> };

/** The patient's consents, newest first. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("consents", "read");
  return ok(await listPatientConsents(parseId((await ctx.params).id), session));
});

/** { template, language, includeEnglish } — make a consent for this patient. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("consents", "write");
  return created(await makeConsent(parseId((await ctx.params).id), await readJson(req), session));
});
