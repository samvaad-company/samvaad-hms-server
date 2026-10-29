import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { billingCatalog } from "@/services/billing-catalog-service";

/** ?patientId=&contractId= — services priced from that patient's rate plan, their GST, payment modes and the billing switches. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("billing", "read");
  const raw = new URL(req.url).searchParams.get("patientId");
  const patientId = raw ? Number(raw) : null;
  const rawContract = new URL(req.url).searchParams.get("contractId");
  const contractId = rawContract ? Number(rawContract) : null;
  return ok(await billingCatalog(
    patientId !== null && Number.isInteger(patientId) && patientId > 0 ? patientId : null, session,
    contractId !== null && Number.isInteger(contractId) && contractId > 0 ? contractId : null,
  ));
});
