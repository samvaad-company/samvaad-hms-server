import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getShelfLife, setShelfLife } from "@/services/cssd-service";

/** How long a set stays sterile, by method × packaging (defaults with the hospital's changes). */
export const GET = withRoute(async () => ok(await getShelfLife(await requirePermission("cssd", "read"))));

/** { method, packaging, days } — days null puts the cell back to the default. */
export const PATCH = withRoute(async (req) => {
  const session = await requirePermission("cssd", "write");
  return ok(await setShelfLife(await readJson(req), session));
});
export const PUT = PATCH;
