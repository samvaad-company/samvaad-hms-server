/** Every "referred by" and "family of" link recorded on an appointment, newest first. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listLinks } from "@/services/loyalty-service";

export const GET = withRoute(async () => ok(await listLinks(await requirePermission("admin", "read"))));
