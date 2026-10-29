import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listSets, registerSet } from "@/services/cssd-service";

export const GET = withRoute(async () => ok(await listSets(await requirePermission("cssd", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("cssd", "write");
  return created(await registerSet(await readJson(req), session));
});
