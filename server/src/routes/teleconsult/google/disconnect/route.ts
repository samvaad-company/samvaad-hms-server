import { withRoute } from "@/http/handler";
import { noContent } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { requireHospitalId } from "@/services/hospital-scope";
import { disconnectGoogle } from "@/services/google-meet";
import { audit } from "@/services/audit";

export const POST = withRoute(async () => {
  const session = await requirePermission("admin", "write");
  const hospitalId = requireHospitalId(session);
  await disconnectGoogle(hospitalId);
  await audit(session, "disconnect", "google", hospitalId);
  return noContent();
});
