import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getBoard } from "@/services/housekeeping-service";

/** The cleaning board, room readiness and the lists the dialogs pick from. */
export const GET = withRoute(async () => ok(await getBoard(await requirePermission("beds", "read"))));
