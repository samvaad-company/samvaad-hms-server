import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { getSheet, saveSheet } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** ?date=yyyy-mm-dd (default today). A day with nothing written yet shows the previous day's plan. */
export const GET = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await getSheet(parseId((await ctx.params).id), sp(req).get("date") ?? undefined, await requirePermission("ipd", "read"))));

/** { date?, plan?, instructions?, investigations?, callDoctor? } — what is sent is saved; the rest stays. */
export const PUT = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await saveSheet(parseId((await ctx.params).id), await readJson(req), await requirePermission("ipd", "edit"))));
