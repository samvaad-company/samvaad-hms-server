import { type ApiRequest, ApiResponse, publicOrigin } from "@/http/web";
import { withRoute } from "@/http/handler";
import { requirePermission } from "@/auth/server";
import { completeConnect, GoogleReconnectError } from "@/services/google-meet";
import { audit } from "@/services/audit";

/** Google redirects here after consent. Redirects back to Admin → Settings with the outcome. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  const url = new URL(req.url);
  const origin = publicOrigin(req);
  const back = (result: string) => ApiResponse.redirect(new URL(`/admin?google=${result}`, origin));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) return back("denied");
  try {
    const { hospitalId, email } = await completeConnect(code, state, origin);
    if (hospitalId !== session.hospitalId) return back("error");
    await audit(session, "connect", "google", hospitalId, { email });
    return back("connected");
  } catch (err) {
    return back(err instanceof GoogleReconnectError ? "scope" : "error");
  }
});
