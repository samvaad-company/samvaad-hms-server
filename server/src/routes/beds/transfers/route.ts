import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listBedTransfers } from "@/services/beds-service";

/** Bed transfer history — newest first. */
export const GET = withRoute(async () => {
  const session = await requirePermission("beds", "read");
  return ok(await listBedTransfers(session));
});
