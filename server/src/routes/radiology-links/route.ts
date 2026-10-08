/**
 * Hospital ↔ radiology center links. Reachable by both hospital and center
 * accounts (with different permissions), so authorization is enforced in
 * the service layer rather than a single RBAC resource gate here.
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requireSession } from "@/auth/server";
import { listLinks, requestLink } from "@/services/hospital-radiology-links-service";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await listLinks(session));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  return created(await requestLink(await readJson(req), session));
});
