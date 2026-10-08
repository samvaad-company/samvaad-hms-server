import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { can } from "@/auth/rbac";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { doctorsRepo } from "@/repositories";
import { slotsFor } from "@/services/scheduling-service";

/**
 * The times a doctor can be booked: ?doctorId=…&date=YYYY-MM-DD&mode=in_person|video
 * (&excludeAppointmentId=… when moving an appointment, so it doesn't block itself).
 * Each time is `open`, `booked` (that exact time is taken) or `full` (the hour's places are used up).
 */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  if (!can(session.role, "appointments", "read") && !can(session.role, "teleconsult", "read")) {
    throw new ForbiddenError("You can't view appointment slots");
  }
  const q = new URL(req.url).searchParams;
  const doctorId = Number(q.get("doctorId"));
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new BadRequestError("Choose a doctor");
  const doctor = await doctorsRepo.getRow(doctorId);
  if (!doctor || (session.role !== "Platform Admin" && doctor.hospital_id !== session.hospitalId)) throw new NotFoundError("Doctor");
  const exclude = Number(q.get("excludeAppointmentId"));
  return ok(await slotsFor({
    doctorId,
    date: q.get("date") ?? "",
    mode: q.get("mode") === "video" ? "video" : "in_person",
    excludeAppointmentId: Number.isInteger(exclude) && exclude > 0 ? exclude : undefined,
  }));
});
