import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listUsers, createUser } from "@/services/admin-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("admin", "read");
  return ok(await listUsers(session));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  return created(await createUser(await readJson(req), session));
});
