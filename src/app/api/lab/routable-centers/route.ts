import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listRoutableCenters } from "@/server/services/lab-service";

/** Centers the caller's hospital has an active link with — for the order-routing picker. */
export const GET = withRoute(async () => {
  const session = await requirePermission("lab", "read");
  return ok(await listRoutableCenters(session));
});
