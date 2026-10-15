import { withRoute } from "@/http/handler";
import { parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { type ApiRequest } from "@/http/web";
import { getStoredPrescriptionReview, reviewPrescription } from "@/services/prescription-ai-review";

type Ctx = { params: Promise<{ id: string }> };

/** The stored review for an unchanged prescription, or null — never calls the model. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "read");
  const { id } = await ctx.params;
  return ok(await getStoredPrescriptionReview(parseId(id), session));
});

/** Run (or, unless `refresh` is set, reuse) the AI safety review. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "read");
  const { id } = await ctx.params;
  const body = ((await readJson(req).catch(() => ({}))) ?? {}) as { refresh?: boolean };
  return ok(await reviewPrescription(parseId(id), session, { refresh: body.refresh === true }));
});
