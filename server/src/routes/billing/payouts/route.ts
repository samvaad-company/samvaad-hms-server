import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listPayouts } from "@/services/payouts-service";

/** ?status=&role=&payee=&from=&to= — what the payout rules have earned on invoices, and what each payee is owed. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("billing", "read");
  const q = new URL(req.url).searchParams;
  const get = (k: string) => q.get(k) || undefined;
  return ok(await listPayouts({ status: get("status"), role: get("role"), payee: get("payee"), from: get("from"), to: get("to") }, session));
});
