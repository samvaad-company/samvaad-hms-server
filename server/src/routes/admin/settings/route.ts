import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession, requirePermission } from "@/auth/server";
import { getSettings, updateSettings } from "@/services/admin-service";

/** Settings are readable by any authenticated user (e.g. for bill headers). */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(await getSettings(session));
});

export const PUT = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  return ok(await updateSettings(await readJson(req), session));
});
export const PATCH = PUT;
