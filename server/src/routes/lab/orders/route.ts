/** Books multiple tests for one patient as a single lab order. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { createLabOrder } from "@/services/lab-service";

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("lab", "write");
  return created(await createLabOrder(await readJson(req), session));
});
