/**
 * Reports whether Firebase Storage is configured and whether the current
 * user can upload (vs. read-only), so the report-upload UI can decide what
 * to render before ever calling Firebase. Never exposes credentials.
 */
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { isFirebaseStorageConfigured, canUploadReports } from "@/server/services/firebase-admin";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok({
    available: isFirebaseStorageConfigured(),
    canUpload: canUploadReports(session.role),
  });
});
