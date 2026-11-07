/** ?patientId= — the patient's card and what it does to their prices (OPD and emergency fee, lab/pharmacy/radiology/IPD discounts). */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requireSession } from "@/auth/server";
import { getPricing } from "@/services/loyalty-service";

export const GET = withRoute(async (req) => {
  const session = await requireSession();
  const patientId = Number(new URL(req.url, "http://localhost").searchParams.get("patientId"));
  if (!Number.isInteger(patientId) || patientId <= 0) throw new BadRequestError("patientId is required");
  return ok(await getPricing(patientId, session));
});
