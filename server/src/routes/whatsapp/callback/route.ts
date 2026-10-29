import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { connectWithCode } from "@/services/whatsapp-service";

/** Meta Embedded Signup finished: { code, wabaId, phoneNumberId }. The code is swapped for a token on the server. */
export const POST = withRoute(async (req) => ok(await connectWithCode(await readJson(req), await requirePermission("admin", "write"))));
