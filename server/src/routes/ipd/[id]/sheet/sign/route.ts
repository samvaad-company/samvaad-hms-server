import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { signSheet } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** { date? } — the doctor reviews and signs the day's treatment sheet. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await signSheet(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), await requirePermission("ipd", "edit"))));
