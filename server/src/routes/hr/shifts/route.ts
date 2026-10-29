import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listShifts, createShift } from "@/services/hr-roster-service";

export const GET = withRoute(async () => ok(await listShifts(await requirePermission("hr", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("hr", "write");
  return created(await createShift(await readJson(req), session));
});
