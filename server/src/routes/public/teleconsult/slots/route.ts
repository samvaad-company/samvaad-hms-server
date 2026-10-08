import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { availableSlots, resolveBookingLink } from "@/services/teleconsult-service";

/** Open times for one doctor on one date: ?token=…&doctorId=…&date=YYYY-MM-DD. */
export const GET = withRoute(async (req: ApiRequest) => {
  const q = new URL(req.url).searchParams;
  const { hospitalId } = await resolveBookingLink(q.get("token"));
  const doctorId = Number(q.get("doctorId"));
  if (!Number.isInteger(doctorId) || doctorId < 1) throw new BadRequestError("Choose a doctor");
  return ok(await availableSlots(hospitalId, doctorId, q.get("date") ?? ""));
});
