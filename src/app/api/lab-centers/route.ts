import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, created } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listCenters, createCenter } from "@/server/services/lab-centers-service";

/** Platform-admin only; the service enforces this beyond the "admin" RBAC gate. */
export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await listCenters(session));
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createCenter(await readJson(req), session));
});
