import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listAudit } from "@/services/audit-trail-service";

/** ?q=&module=&action=&actor=&from=&to=&page=&pageSize= — the hospital's audit trail, newest first. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("admin", "read");
  const q = new URL(req.url).searchParams;
  const get = (k: string) => q.get(k) || undefined;
  return ok(await listAudit({ q: get("q"), module: get("module"), action: get("action"), actor: get("actor"), from: get("from"), to: get("to"), page: Number(q.get("page")) || undefined, pageSize: Number(q.get("pageSize")) || undefined }, session));
});
