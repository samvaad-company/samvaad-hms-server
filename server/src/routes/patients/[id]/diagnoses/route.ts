import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { listPatientDiagnoses, savePatientDiagnoses } from "@/services/diagnoses-service";

type Ctx = { params: Promise<{ id: string }> };

/** Every diagnosis doctors have recorded for this patient, newest first. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("patients", "read");
  return ok(await listPatientDiagnoses(parseId((await ctx.params).id), session));
});

/** The Save button on the prescription: put what the doctor wrote in the patient's diagnoses (and the doctor's own list). */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  return created(await savePatientDiagnoses(parseId((await ctx.params).id), await readJson(req), session));
});
