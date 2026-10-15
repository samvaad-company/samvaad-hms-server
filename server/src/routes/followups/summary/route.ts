import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getFollowUpSummary } from "@/services/followups-service";

/** Overdue / due today / next 14 days, plus how many are pending, done and missed. */
export const GET = withRoute(async () => ok(await getFollowUpSummary(await requirePermission("followups", "read"))));
