import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { sendTest } from "@/services/whatsapp-service";

/** { to } — send a short test message from the connected number. */
export const POST = withRoute(async (req) => ok(await sendTest(await readJson(req), await requirePermission("admin", "write"))));
