import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, noContent } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { updateUser, deleteUser } from "@/services/admin-service";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  return ok(await updateUser(parseId(id), await readJson(req), session));
});
export const PATCH = PUT;

export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  await deleteUser(parseId(id), session);
  return noContent();
});
