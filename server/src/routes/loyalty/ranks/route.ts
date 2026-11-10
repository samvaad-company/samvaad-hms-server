/** Each patient's loyalty rank and each rank's colour and stars: what any screen needs to show stars beside a patient's name. Any signed-in staff member. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { rankIndex } from "@/services/loyalty-service";

export const GET = withRoute(async () => ok(await rankIndex(await requireSession())));
