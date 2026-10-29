import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getRoster, setRoster } from "@/services/hr-roster-service";

/** ?from=YYYY-MM-DD&to=YYYY-MM-DD (at most 62 days). */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("hr", "read");
  const q = new URL(req.url).searchParams;
  return ok(await getRoster(q.get("from"), q.get("to"), session));
});

/** { staffId, date, shiftId } — a null shiftId clears the day. */
export const PUT = withRoute(async (req) => {
  const session = await requirePermission("hr", "write");
  return ok(await setRoster(await readJson(req), session));
});
