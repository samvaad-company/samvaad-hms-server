import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { listIo, addIo } from "@/services/ipd-chart-service";

type Ctx = { params: Promise<{ id: string }> };
const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** Intake and output entries, newest first, with the last 24 hours' totals. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await listIo(parseId((await ctx.params).id), await requirePermission("nursing", "read"))));

/** { kind: "In" | "Out", category, amountMl, note?, recordedAt? } */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => created(await addIo(parseId((await ctx.params).id), await readJson(req), await requirePermission("nursing", "write"))));
