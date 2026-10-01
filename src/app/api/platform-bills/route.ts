import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, created } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listPlatformBills, createPlatformBill } from "@/server/services/platform-billing-service";

/** Platform-admin only; the service enforces this beyond the "admin" RBAC gate. */
export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await listPlatformBills(session));
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createPlatformBill(await readJson(req), session));
});
