import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, created } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { listUsers, createUser } from "@/server/services/admin-service";

export const GET = withRoute(async () => {
  await requirePermission("admin", "read");
  return ok(await listUsers());
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createUser(await readJson(req), session));
});
