import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listHospitals, createHospital } from "@/services/hospitals-service";

/** Platform-admin only; the service enforces this beyond the "admin" RBAC gate. */
export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await listHospitals(session));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createHospital(await readJson(req), session));
});
