import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { noContent } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { deleteDoctorDiagnosis } from "@/services/diagnoses-service";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  await deleteDoctorDiagnosis(parseId((await ctx.params).id), session);
  return noContent();
});
