/** The forms waiting on the caller: a doctor's to sign, the hospital admin's to stamp. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { pendingForMe } from "@/services/preauth-service";

export const GET = withRoute(async () => ok(await pendingForMe(await requireSession())));
