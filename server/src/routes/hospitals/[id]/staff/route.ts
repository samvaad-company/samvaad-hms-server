import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { parseListParams, readJson } from "@/http/query";
import { created, paginated, makePaginationMeta } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { STAFF_LIST_CONFIG } from "@/services/staff-service";
import { listHospitalStaff, createHospitalStaff } from "@/services/hospitals-service";

type Ctx = { params: Promise<{ id: string }> };

/** Platform admin: one hospital's staff directory (same query params as `GET /api/staff`). */
export const GET = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "read");
  const { id } = await ctx.params;
  const options = parseListParams(req, STAFF_LIST_CONFIG);
  const { rows, total } = await listHospitalStaff(parseId(id), options, session);
  return paginated(rows, makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total));
});

/** Platform admin: add a person to one hospital's staff directory. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  return created(await createHospitalStaff(parseId(id), await readJson(req), session));
});
