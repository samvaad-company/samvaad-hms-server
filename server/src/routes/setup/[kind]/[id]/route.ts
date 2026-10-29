import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, noContent } from "@/http/response";
import { NotFoundError } from "@/lib/errors";
import { parseId } from "@/http/crud";
import { requirePermission, requireSession } from "@/auth/server";
import { isKind, getSetup, updateSetup, deleteSetup, PUBLIC_READ } from "@/services/setup-service";

type Ctx = { params: Promise<{ kind: string; id: string }> };

async function target(ctx: Ctx) {
  const { kind, id } = await ctx.params;
  if (!isKind(kind)) throw new NotFoundError("Master");
  return { kind, id: parseId(id) };
}

export const GET = withRoute(async (_req, ctx: Ctx) => {
  const { kind, id } = await target(ctx);
  const session = PUBLIC_READ.has(kind) ? await requireSession() : await requirePermission("admin", "read");
  return ok(await getSetup(kind, id, session));
});

const update = withRoute(async (req, ctx: Ctx) => {
  const { kind, id } = await target(ctx);
  const session = await requirePermission("admin", "write");
  return ok(await updateSetup(kind, id, await readJson(req), session));
});
export const PATCH = update;
export const PUT = update;

export const DELETE = withRoute(async (_req, ctx: Ctx) => {
  const { kind, id } = await target(ctx);
  const session = await requirePermission("admin", "write");
  await deleteSetup(kind, id, session);
  return noContent();
});
