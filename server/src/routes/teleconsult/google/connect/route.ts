import { type ApiRequest, ApiResponse, publicOrigin } from "@/http/web";
import { withRoute } from "@/http/handler";
import { requirePermission } from "@/auth/server";
import { requireHospitalId } from "@/services/hospital-scope";
import { buildConnectUrl } from "@/services/google-meet";

/** Starts the Google sign-in for the hospital's Meet account (an admin opens this in the browser). */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  const url = await buildConnectUrl(requireHospitalId(session), session.userId, publicOrigin(req));
  return ApiResponse.redirect(url);
});
