/** Orders multiple studies for one patient as a single radiology order. */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { created } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { createRadiologyOrder } from "@/server/services/radiology-service";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("radiology", "write");
  return created(await createRadiologyOrder(await readJson(req), session));
});
