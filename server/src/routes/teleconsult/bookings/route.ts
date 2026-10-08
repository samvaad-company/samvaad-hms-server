import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { createStaffBooking } from "@/services/teleconsult-service";

/** Tele-caller / admin books a video consultation for a patient (fee collected outside the system). */
export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("teleconsult", "write");
  const body = await req.json().catch(() => ({}));
  return created(await createStaffBooking(body, session));
});
