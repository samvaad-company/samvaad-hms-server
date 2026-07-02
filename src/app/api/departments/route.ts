import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, created } from "@/server/http/response";
import { requireSession, requirePermission } from "@/server/auth/server";
import { listDepartments, createDepartment } from "@/server/services/admin-service";

/** Readable by any authenticated user (used by doctor/staff dropdowns). */
export const GET = withRoute(async () => {
  await requireSession();
  return ok(await listDepartments());
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createDepartment(await readJson(req), session));
});
