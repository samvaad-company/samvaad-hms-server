/** Roles & access. GET: every role's built-in and current level per part of the app (anyone who can read the admin panel).
 *  PUT { role, levels } or { role, reset: true }: change one role's levels (the hospital's Super Admin only). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission, requireSession } from "@/auth/server";
import { getRoleAccess, saveRoleAccess } from "@/services/role-access-service";

export const GET = withRoute(async () => ok(await getRoleAccess(await requirePermission("admin", "read"))));
export const PUT = withRoute(async (req: ApiRequest) => ok(await saveRoleAccess(await readJson(req), await requireSession())));
