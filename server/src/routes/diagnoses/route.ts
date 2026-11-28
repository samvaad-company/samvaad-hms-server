/** The signed-in doctor's own diagnosis list (or a chosen doctor's, for staff writing a prescription for them). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listDoctorDiagnoses, addDoctorDiagnosis } from "@/services/diagnoses-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "read");
  const sp = new URL(req.url, "http://localhost").searchParams;
  const doctorId = Number(sp.get("doctorId"));
  return ok(await listDoctorDiagnoses(session, { doctorId: Number.isInteger(doctorId) && doctorId > 0 ? doctorId : null, q: sp.get("q") ?? "", limit: Math.min(100, Number(sp.get("limit")) || 20) }));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "write");
  return created(await addDoctorDiagnosis(await readJson(req), session));
});
