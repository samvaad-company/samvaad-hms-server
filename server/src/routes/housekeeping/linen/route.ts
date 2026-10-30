import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getLinen } from "@/services/housekeeping-service";

/** Linen balances by category (store, wards, soiled, laundry) and the latest movements. */
export const GET = withRoute(async () => ok(await getLinen(await requirePermission("beds", "read"))));
