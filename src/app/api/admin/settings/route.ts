import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { requireSession, requirePermission } from "@/server/auth/server";
import { getSettings, updateSettings } from "@/server/services/admin-service";

/** Settings are readable by any authenticated user (e.g. for bill headers). */
export const GET = withRoute(async () => {
  await requireSession();
  return ok(await getSettings());
});

export const PUT = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("admin", "write");
  return ok(await updateSettings(await readJson(req), session));
});
export const PATCH = PUT;
