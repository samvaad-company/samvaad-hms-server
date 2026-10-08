/**
 * Reports whether Firebase Storage is configured and whether the current
 * user can upload (vs. read-only), so the report-upload UI can decide what
 * to render before ever calling Firebase. Never exposes credentials.
 */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { isFirebaseStorageConfigured, canUploadReports } from "@/services/firebase-admin";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok({
    available: isFirebaseStorageConfigured(),
    canUpload: canUploadReports(session.role),
  });
});
