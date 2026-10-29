import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { publicSign } from "@/services/consents-service";

/** { name, relation, agree, signature (PNG data URL), language } with ?token=… */
export const POST = withRoute(async (req) => ok(await publicSign(new URL(req.url).searchParams.get("token"), await readJson(req))));
