/** ?q=&patientId= — every combined bill issued, newest first. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { combinedBillHistory } from "@/services/combined-bill-service";

export const GET = withRoute(async (req) => {
  const session = await requirePermission("billing", "read");
  return ok(await combinedBillHistory(new URL(req.url, "http://localhost").searchParams, session));
});
