import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { publicBookingSession } from "@/services/teleconsult-service";

/** Public booking page: hospital, patient's first name, fee and doctors. Authenticated by the signed link token alone. */
export const GET = withRoute(async (req: ApiRequest) => {
  return ok(await publicBookingSession(new URL(req.url).searchParams.get("token")));
});
