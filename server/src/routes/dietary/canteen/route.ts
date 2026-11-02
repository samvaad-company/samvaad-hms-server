import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getCanteen } from "@/services/dietary-service";

/** ?date= — the menu and the day's sales. */
export const GET = withRoute(async (req) => ok(await getCanteen({ date: new URL(req.url).searchParams.get("date") || undefined }, await requirePermission("ipd", "read"))));
