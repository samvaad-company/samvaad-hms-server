import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePortalKey } from "@/auth/portal";
import { createPortalBooking } from "@/services/teleconsult-service";

/** Patient app: start a paid video consultation. The fee comes from the hospital's price, never from the request. */
export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const body = await req.json().catch(() => ({}));
  return created(await createPortalBooking(body));
});
