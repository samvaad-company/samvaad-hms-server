import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listBedsByWard } from "@/server/services/beds-service";

/** Beds grouped by ward with occupancy summary — drives the wards board. */
export const GET = withRoute(async () => {
  const session = await requirePermission("beds", "read");
  return ok(await listBedsByWard(session));
});
