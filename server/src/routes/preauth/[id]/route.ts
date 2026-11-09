/** One pre-auth form: read it, change its details (until the doctor signs), or delete it. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { getForm, removeForm, updateForm } from "@/services/preauth-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getForm(parseId((await ctx.params).id), await requireSession())));
const update = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await updateForm(parseId((await ctx.params).id), await readJson(req), await requireSession())));
export const PUT = update;
export const PATCH = update;
export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await removeForm(parseId((await ctx.params).id), await requireSession())));
