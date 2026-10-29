import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { importServices } from "@/services/setup-service";

/** { rows: [{ name, code, group, price, unit, … }] } — creates or updates services by code. */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("admin", "write");
  return ok(await importServices(await readJson(req), session));
});
