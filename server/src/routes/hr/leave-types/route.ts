import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listLeaveTypes, createLeaveType } from "@/services/hr-leave-service";

export const GET = withRoute(async () => ok(await listLeaveTypes(await requirePermission("hr", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("hr", "write");
  return created(await createLeaveType(await readJson(req), session));
});
