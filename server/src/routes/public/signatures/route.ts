import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { publicForm } from "@/services/consents-service";

/** The form a patient's phone opens: ?token=… Authenticated by the link's random token alone. */
export const GET = withRoute(async (req) => ok(await publicForm(new URL(req.url).searchParams.get("token"))));
