import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePortalKey } from "@/auth/portal";
import { BadRequestError } from "@/lib/errors";
import { slotsFor } from "@/services/scheduling-service";

/** Patient app: the times a doctor can be booked. ?doctorId=…&date=YYYY-MM-DD&mode=in_person|video (&excludeAppointmentId=… when moving one). */
export const GET = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const q = new URL(req.url).searchParams;
  const doctorId = Number(q.get("doctorId"));
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new BadRequestError("Choose a doctor");
  const exclude = Number(q.get("excludeAppointmentId"));
  return ok(await slotsFor({
    doctorId,
    date: q.get("date") ?? "",
    mode: q.get("mode") === "video" ? "video" : "in_person",
    excludeAppointmentId: Number.isInteger(exclude) && exclude > 0 ? exclude : undefined,
  }));
});
