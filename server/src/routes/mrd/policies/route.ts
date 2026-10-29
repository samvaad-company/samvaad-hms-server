import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listPolicies, createPolicy } from "@/services/mrd-documents-service";

export const GET = withRoute(async () => ok(await listPolicies(await requirePermission("mrd", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("mrd", "write");
  return created(await createPolicy(await readJson(req), session));
});
