import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listLocations, createLocation } from "@/services/mrd-files-service";

export const GET = withRoute(async () => ok(await listLocations(await requirePermission("mrd", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("mrd", "write");
  return created(await createLocation(await readJson(req), session));
});
