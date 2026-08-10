/** Books multiple tests for one patient as a single lab order. */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { created } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { createLabOrder } from "@/server/services/lab-service";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("lab", "write");
  return created(await createLabOrder(await readJson(req), session));
});
