import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { BadRequestError } from "@/lib/errors";
import { requireHospitalId } from "@/services/hospital-scope";
import { availableSlots } from "@/services/teleconsult-service";

/** Staff booking form: open times for a doctor on a date (?doctorId=…&date=YYYY-MM-DD). */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("teleconsult", "read");
  const q = new URL(req.url).searchParams;
  const doctorId = Number(q.get("doctorId"));
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new BadRequestError("Choose a doctor");
  return ok(await availableSlots(requireHospitalId(session), doctorId, q.get("date") ?? ""));
});
