import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { deleteVaccination } from "@/services/patient-vaccinations-service";

type Ctx = { params: Promise<{ id: string; vid: string }> };

export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const { id, vid } = await ctx.params;
  await deleteVaccination(parseId(id), parseId(vid), await requirePermission("patients", "edit"));
  return ok({ deleted: true });
});
