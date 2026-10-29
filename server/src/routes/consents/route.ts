import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { listConsents, makeConsent, type ConsentBucket } from "@/services/consents-service";

const BUCKETS = ["draft", "waiting", "signed", "refused", "ended", "all"];

/** ?status=draft|waiting|signed|refused|ended|all &q=search — every consent with the filter counts. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("consents", "read");
  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "all";
  return ok(await listConsents(session, (BUCKETS.includes(status) ? status : "all") as ConsentBucket, url.searchParams.get("q") ?? ""));
});

/** { patientId, template, language, includeEnglish } — make a consent for a patient. */
export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("consents", "write");
  const body = (await readJson(req)) as Record<string, unknown>;
  const patientId = Number(body.patientId);
  if (!Number.isInteger(patientId) || patientId <= 0) throw new BadRequestError("A valid patientId is required");
  return created(await makeConsent(patientId, body, session));
});
