import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { listWards, createWard } from "@/services/wards-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("beds", "read");
  return ok(await listWards(session));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("beds", "write");
  return created(await createWard(await readJson(req), session));
});
