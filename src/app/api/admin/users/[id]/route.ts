import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, noContent } from "@/server/http/response";
import { parseId } from "@/server/http/crud";
import { requirePermission } from "@/server/auth/server";
import { updateUser, deleteUser } from "@/server/services/admin-service";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  return ok(await updateUser(parseId(id), await readJson(req), session));
});
export const PATCH = PUT;

export const DELETE = withRoute(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  await deleteUser(parseId(id), session);
  return noContent();
});
