/** Orders multiple studies for one patient as a single radiology order. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { createRadiologyOrder } from "@/services/radiology-service";

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("radiology", "write");
  return created(await createRadiologyOrder(await readJson(req), session));
});
