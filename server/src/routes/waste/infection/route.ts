import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getInfectionControl } from "@/services/waste-ic-service";

/** Infection events (open ones first) and hand-hygiene audits. */
export const GET = withRoute(async () => ok(await getInfectionControl(await requirePermission("cssd", "read"))));
