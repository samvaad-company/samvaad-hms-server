import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listBedTransfers } from "@/server/services/beds-service";

/** Bed transfer history — newest first. */
export const GET = withRoute(async () => {
  await requirePermission("beds", "read");
  return ok(await listBedTransfers());
});
