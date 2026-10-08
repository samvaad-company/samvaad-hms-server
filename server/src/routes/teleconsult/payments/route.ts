import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listPayments } from "@/services/teleconsult-service";

/** Every tele-consult fee: who paid how much, how, and whether it was refunded. */
export const GET = withRoute(async () => {
  const session = await requirePermission("teleconsult", "read");
  return ok(await listPayments(session));
});
