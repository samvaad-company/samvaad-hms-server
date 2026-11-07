/** ?patientId=&from=&to= — one statement with every bill, prescription and admission for the patient. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { combinedBill } from "@/services/combined-bill-service";

export const GET = withRoute(async (req) => {
  const session = await requirePermission("finance", "read");
  return ok(await combinedBill(new URL(req.url, "http://localhost").searchParams, session));
});
