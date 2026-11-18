/** GET ?search=&discharged=1 lists the admitted insurance / cashless patients a claim form can be made for. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { listCandidates } from "@/services/claim-forms-service";

export const GET = withRoute(async (req: ApiRequest) => ok(await listCandidates(new URL(req.url, "http://localhost").searchParams, await requireSession())));
