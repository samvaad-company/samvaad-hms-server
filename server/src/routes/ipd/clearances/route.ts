/** The discharge requests waiting on the departments the signed-in user works in. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { clearanceInbox } from "@/services/ipd-clearance-service";

// Not tied to the IPD permission: pharmacy, lab and the other departments answer from here. Each row is shown only to the departments it is for.
export const GET = withRoute(async () => ok(await clearanceInbox(await requireSession())));
