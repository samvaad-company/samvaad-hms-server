import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getFollowUpAnalytics } from "@/services/followups-service";

/** ?days=30|90|180|365 &doctorId=… — counts per day, by who booked/marked them, and per doctor. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("followups", "read");
  const sp = new URL(req.url).searchParams;
  const doctorId = Number(sp.get("doctorId"));
  return ok(await getFollowUpAnalytics({ days: Number(sp.get("days")) || 90, doctorId: Number.isInteger(doctorId) && doctorId > 0 ? doctorId : null }, session));
});
