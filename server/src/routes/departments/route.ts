import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requireSession, requirePermission } from "@/auth/server";
import { listDepartments, createDepartment } from "@/services/admin-service";

/** Readable by any authenticated user (used by doctor/staff dropdowns). */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await listDepartments(session));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createDepartment(await readJson(req), session));
});
