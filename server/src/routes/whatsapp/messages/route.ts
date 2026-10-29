import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listMessages } from "@/services/whatsapp-service";

/** Recent messages in and out through the connected number (numbers masked). */
export const GET = withRoute(async (req) => ok(await listMessages(await requirePermission("admin", "read"), Number(new URL(req.url).searchParams.get("limit")) || 40)));
