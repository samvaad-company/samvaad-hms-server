import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { publicRefuse } from "@/services/consents-service";

/** { reason? } with ?token=… */
export const POST = withRoute(async (req) => ok(await publicRefuse(new URL(req.url).searchParams.get("token"), await readJson(req).catch(() => ({})))));
