import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getNurseBoard } from "@/services/nurse-station-service";

/** Open alerts (worked out fresh each time) and this shift's tasks. */
export const GET = withRoute(async () => ok(await getNurseBoard(await requirePermission("nursing", "read"))));
