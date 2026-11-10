/** The order a hospital keeps its case-file forms in. GET: the order (any staff who can read case files). PUT { order } or { reset: true }: rearrange (the hospital's Super Admin only). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission, requireSession } from "@/auth/server";
import { getFormOrder, saveFormOrder } from "@/services/casefile-service";

export const GET = withRoute(async () => ok(await getFormOrder(await requirePermission("casefile", "read"))));
export const PUT = withRoute(async (req: ApiRequest) => ok(await saveFormOrder(await readJson(req), await requireSession())));
