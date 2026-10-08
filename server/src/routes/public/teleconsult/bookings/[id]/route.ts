import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { resolveBookingLink } from "@/services/teleconsult-service";
import { getPortalBookingSynced } from "@/services/teleconsult-payments";

/** Status of one booking (the page polls this after paying). */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const { patientId } = await resolveBookingLink(new URL(req.url).searchParams.get("token"));
  return ok(await getPortalBookingSynced(parseId(id), patientId));
});
