import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getKitchen } from "@/services/dietary-service";

/** ?date= — the production plan: each diet at each meal, across every ward. */
export const GET = withRoute(async (req) => ok(await getKitchen({ date: new URL(req.url).searchParams.get("date") || undefined }, await requirePermission("ipd", "read"))));
