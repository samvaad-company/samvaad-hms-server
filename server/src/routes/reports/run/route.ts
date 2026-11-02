import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { runReport } from "@/services/report-engine";

/** ?id=daybook_opd&from=2026-10-01&to=2026-10-30&q=… — one report as a table. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("reports", "read");
  const q = new URL(req.url).searchParams;
  return ok(await runReport({ id: q.get("id") ?? "", from: q.get("from") ?? undefined, to: q.get("to") ?? undefined, q: q.get("q") ?? undefined }, session));
});
