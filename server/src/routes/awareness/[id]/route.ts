/** One awareness programme: read, edit or delete. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { getAwareness, removeAwareness, updateAwareness } from "@/services/awareness-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getAwareness(parseId((await ctx.params).id), await requirePermission("awareness", "read"))));
const update = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await updateAwareness(parseId((await ctx.params).id), await readJson(req), await requirePermission("awareness", "write"))));
export const PUT = update;
export const PATCH = update;
export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await removeAwareness(parseId((await ctx.params).id), await requirePermission("awareness", "write"))));
