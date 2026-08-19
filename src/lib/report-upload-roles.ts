/**
 * Roles allowed to upload radiology/lab report files. Deliberately narrower
 * than the `radiology`/`lab` RBAC "write" level (which Doctors also hold,
 * for ordering tests and updating status) — only the roles that actually
 * handle report files can upload them. Framework-free so both server code
 * (firebase-admin.ts, the report-upload services) and client components
 * (upload button visibility) can import it without pulling in firebase-admin
 * or any other Node-only dependency into the browser bundle.
 */
const REPORT_UPLOAD_ROLES = new Set(["Lab Technician", "Lab Partner", "Radiology Partner", "Super Admin"]);

export function canUploadReports(role: string | undefined | null): boolean {
  return Boolean(role && REPORT_UPLOAD_ROLES.has(role));
}
