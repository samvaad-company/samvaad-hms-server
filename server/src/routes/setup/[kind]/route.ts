import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { NotFoundError } from "@/lib/errors";
import { requirePermission, requireSession } from "@/auth/server";
import { isKind, listSetup, createSetup, PUBLIC_READ } from "@/services/setup-service";

type Ctx = { params: Promise<{ kind: string }> };

export const GET = withRoute(async (req, ctx: Ctx) => {
  const { kind } = await ctx.params;
  if (!isKind(kind)) throw new NotFoundError("Master");
  const session = PUBLIC_READ.has(kind) ? await requireSession() : await requirePermission("admin", "read");
  const activeOnly = new URL(req.url).searchParams.get("active") === "1";
  return ok(await listSetup(kind, session, { activeOnly }));
});

export const POST = withRoute(async (req, ctx: Ctx) => {
  const { kind } = await ctx.params;
  if (!isKind(kind)) throw new NotFoundError("Master");
  const session = await requirePermission("admin", "write");
  return created(await createSetup(kind, await readJson(req), session));
});
