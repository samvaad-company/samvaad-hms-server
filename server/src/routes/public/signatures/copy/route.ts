import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { publicCopy } from "@/services/consents-service";

/** The patient's own signed copy, once signed: ?token=… */
export const GET = withRoute(async (req) => ok(await publicCopy(new URL(req.url).searchParams.get("token"))));
