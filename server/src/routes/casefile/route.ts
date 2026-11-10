/** ?status=Admitted|Discharged|all&search= — admitted patients and how much of each case file is filled in. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listCaseFiles } from "@/services/casefile-service";

export const GET = withRoute(async (req) => {
  const session = await requirePermission("casefile", "read");
  return ok(await listCaseFiles(new URL(req.url, "http://localhost").searchParams, session));
});
