import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { getOverview } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** Everything the patient page's Summary and Discharge tabs need, worked out from the ward's records. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getOverview(parseId((await ctx.params).id), await requirePermission("ipd", "read"))));
