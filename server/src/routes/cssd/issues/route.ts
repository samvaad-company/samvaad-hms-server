import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listIssues, requestSet } from "@/services/cssd-service";

export const GET = withRoute(async () => ok(await listIssues(await requirePermission("cssd", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("cssd", "write");
  return created(await requestSet(await readJson(req), session));
});
