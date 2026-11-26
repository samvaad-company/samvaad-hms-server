/** The signed-in doctor's usual medicines for the diseases asked about (?diagnoses=a;b), from their own earlier prescriptions. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { usualMedicines } from "@/services/usual-medicines-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "read");
  const sp = new URL(req.url, "http://localhost").searchParams;
  const doctorId = Number(sp.get("doctorId"));
  return ok(await usualMedicines(session, {
    doctorId: Number.isInteger(doctorId) && doctorId > 0 ? doctorId : null,
    diagnoses: (sp.get("diagnoses") ?? "").split(";").map((x) => x.trim()).filter(Boolean),
    limit: Number(sp.get("limit")) || 8,
  }));
});
