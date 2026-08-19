/**
 * Mints a Firebase custom auth token for the signed-in session. The frontend
 * exchanges this for a Firebase sign-in via signInWithCustomToken(), which is
 * what lets Storage Security Rules see request.auth.token.canUploadReports —
 * a claim only this server can set, since minting requires the Admin SDK's
 * service-account credentials.
 */
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { AppError } from "@/server/lib/errors";
import { requireSession } from "@/server/auth/server";
import { mintStorageToken } from "@/server/services/firebase-admin";

export const POST = withRoute(async () => {
  const session = await requireSession();
  const token = await mintStorageToken(session);
  if (!token) {
    throw new AppError(503, "INTERNAL", "Firebase Storage is not configured on this server.");
  }
  return ok({ token });
});
