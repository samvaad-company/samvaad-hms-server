import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listDiet } from "@/services/nurse-station-service";

export const GET = withRoute(async () => ok(await listDiet(await requirePermission("nursing", "read"))));
