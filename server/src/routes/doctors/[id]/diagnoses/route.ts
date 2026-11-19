import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { listDoctorRecord } from "@/services/diagnoses-service";

type Ctx = { params: Promise<{ id: string }> };

/** The doctor's diagnosis list with how often each was used. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("doctors", "read");
  return ok(await listDoctorRecord(parseId((await ctx.params).id), session));
});
