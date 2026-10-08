import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listRoutableCenters } from "@/services/lab-service";

/** Centers the caller's hospital has an active link with — for the order-routing picker. */
export const GET = withRoute(async () => {
  const session = await requirePermission("lab", "read");
  return ok(await listRoutableCenters(session));
});
