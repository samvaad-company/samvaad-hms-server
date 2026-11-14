/** The H1 register: Schedule H1 drugs given to patients (`?from=&to=&patientId=&search=`). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { h1Register } from "@/services/h1-register-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("pharmacy", "read");
  const sp = new URL(req.url).searchParams;
  const patientId = Number(sp.get("patientId"));
  return ok(await h1Register({ from: sp.get("from") || undefined, to: sp.get("to") || undefined, search: sp.get("search") || undefined, patientId: Number.isInteger(patientId) && patientId > 0 ? patientId : undefined }, session));
});
