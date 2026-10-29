import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { stockSummary } from "@/services/bloodbank-service";

/** Usable units per ABO × Rh group, and how many expire within a week. */
export const GET = withRoute(async () => ok(await stockSummary(await requirePermission("bloodbank", "read"))));
