/** What each supplier / manufacturer pair has in credit (`?supplier=` for one supplier). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { creditBalances } from "@/services/supplier-credit-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("pharmacy", "read");
  const supplier = new URL(req.url).searchParams.get("supplier") ?? undefined;
  return ok(await creditBalances(session, supplier ? { supplier } : undefined));
});
