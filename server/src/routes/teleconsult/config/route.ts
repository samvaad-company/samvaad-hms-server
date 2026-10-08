import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { requireHospitalId } from "@/services/hospital-scope";
import { teleconsultConfig } from "@/services/teleconsult-service";

/** Fee, on/off switch, payment mode and Google connection status for the actor's hospital. */
export const GET = withRoute(async () => {
  const session = await requirePermission("teleconsult", "read");
  return ok(await teleconsultConfig(requireHospitalId(session)));
});
