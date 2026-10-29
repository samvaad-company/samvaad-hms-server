import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getRegister, fileEntry } from "@/services/mrd-registers-service";

type Ctx = { params: Promise<{ kind: string }> };

/** birth | death — ?months=12 keeps only recent entries (what the printout uses). */
export const GET = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("mrd", "read");
  const months = Number(new URL(req.url).searchParams.get("months")) || undefined;
  return ok(await getRegister((await ctx.params).kind, session, months));
});

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("mrd", "write");
  return created(await fileEntry((await ctx.params).kind, await readJson(req), session));
});
