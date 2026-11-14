/** Send stock back to a supplier: it leaves the shelf and earns credit with that supplier and manufacturer. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { returnToSupplier } from "@/services/supplier-credit-service";

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("pharmacy", "write");
  return created(await returnToSupplier(await readJson(req), session));
});
