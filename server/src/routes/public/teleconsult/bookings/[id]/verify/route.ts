import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { resolveBookingLink, verifyPortalPayment } from "@/services/teleconsult-service";

/** The page reports a finished checkout; the gateway signature is verified before anything is confirmed. */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { patientId } = await resolveBookingLink(typeof body.token === "string" ? body.token : null);
  return ok(await verifyPortalPayment(parseId(id), { ...body, patientId }));
});
