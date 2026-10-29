import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { getLite } from "@/services/whatsapp-service";

/** Whether this hospital can send WhatsApp messages — for any signed-in user (it decides which "send" buttons to offer). */
export const GET = withRoute(async () => ok(await getLite(await requireSession())));
