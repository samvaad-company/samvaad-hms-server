import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { updateStay } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** { allergyStatus?, allergies?, payer?, plannedDischargeDate?, dischargeStage? } */
export const PATCH = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await updateStay(parseId((await ctx.params).id), await readJson(req), await requirePermission("ipd", "edit"))));
