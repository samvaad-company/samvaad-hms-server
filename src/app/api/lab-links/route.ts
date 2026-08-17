/**
 * Hospital ↔ lab center links. Reachable by both hospital and center
 * accounts (with different permissions), so authorization is enforced in
 * the service layer rather than a single RBAC resource gate here.
 */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, created } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { listLinks, requestLink } from "@/server/services/hospital-lab-links-service";

export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await listLinks(session));
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requireSession();
  return created(await requestLink(await readJson(req), session));
});
