import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getOtOptions } from "@/services/ot-resources-service";

/** Rooms, equipment and who can be on the team — everything the Book dialog's pickers need. */
export const GET = withRoute(async () => ok(await getOtOptions(await requirePermission("ot", "read"))));
