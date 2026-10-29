import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getRegister } from "@/services/bloodbank-registers";

type Ctx = { params: Promise<{ kind: string }> };

/** ?date=yyyy-mm-dd (default today) — donor | stock | issue | discard | serology */
export const GET = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("bloodbank", "read");
  return ok(await getRegister((await ctx.params).kind, new URL(req.url).searchParams.get("date") ?? undefined, session));
});
