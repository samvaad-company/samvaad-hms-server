/**
 * Firebase Admin bridge for direct-to-Storage report uploads.
 *
 * Reports (radiology scans, lab results) upload straight from the browser to
 * Firebase Storage — this server never touches the file bytes. The only job
 * this module has is minting a short-lived Firebase custom auth token that
 * carries the caller's role as a claim, so Storage Security Rules
 * (storage.rules at the repo root) can decide upload-vs-read-only WITHOUT
 * trusting the browser: the frontend can't fabricate a claim it was never
 * given, since the token is signed server-side with the service-account key.
 *
 * Upload rights are intentionally narrower than this app's own `lab`/
 * `radiology` RBAC "write" level (which Doctors also hold, for ordering and
 * status updates) — only the roles that actually handle report files get
 * Storage upload rights.
 */
import { getConfig } from "@/server/config/env";
import { logger } from "@/server/lib/logger";
import { type Session } from "@/server/auth/session";
import { canUploadReports } from "@/lib/report-upload-roles";

export { canUploadReports };

export function isFirebaseStorageConfigured(): boolean {
  return getConfig().firebaseAdmin !== null;
}

// Cached across hot reloads / serverless invocations, same pattern as the
// Mongo client singleton in mongo-adapter.ts.
declare global {
  var __samvaadFirebaseAdminApp: unknown;
}

async function getAdminAuth() {
  const cfg = getConfig().firebaseAdmin;
  if (!cfg) return null;

  if (!globalThis.__samvaadFirebaseAdminApp) {
    const { initializeApp, cert, getApps } = await import("firebase-admin/app");
    globalThis.__samvaadFirebaseAdminApp =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: cfg.projectId,
          clientEmail: cfg.clientEmail,
          privateKey: cfg.privateKey,
        }),
      });
  }

  const { getAuth } = await import("firebase-admin/auth");
  return getAuth(globalThis.__samvaadFirebaseAdminApp as never);
}

/**
 * Mints a Firebase custom token for the signed-in user, embedding the claims
 * storage.rules checks. Returns null (rather than throwing) when Firebase
 * Admin isn't configured, so callers can surface "feature unavailable"
 * instead of a 500.
 */
export async function mintStorageToken(actor: Session): Promise<string | null> {
  const auth = await getAdminAuth();
  if (!auth) return null;

  try {
    return await auth.createCustomToken(String(actor.userId), {
      role: actor.role,
      canUploadReports: canUploadReports(actor.role),
      hospitalId: actor.hospitalId,
      radiologyCenterId: actor.radiologyCenterId,
      labCenterId: actor.labCenterId,
    });
  } catch (err) {
    logger.warn("firebase.token.error", { error: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
