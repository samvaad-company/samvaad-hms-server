import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { listHospitalUsers, createHospitalUser } from "@/services/hospitals-service";

type Ctx = { params: Promise<{ id: string }> };

/** Platform admin: the logins of one hospital. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "read");
  const { id } = await ctx.params;
  return ok(await listHospitalUsers(parseId(id), session));
});

/** Platform admin: create a login in one hospital (optionally with its staff-directory entry). */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  return created(await createHospitalUser(parseId(id), await readJson(req), session));
});
