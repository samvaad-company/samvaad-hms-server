import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { getTimeline } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** Every step of the stay from each department, in order, with the gaps between them. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getTimeline(parseId((await ctx.params).id), await requirePermission("ipd", "read"))));
