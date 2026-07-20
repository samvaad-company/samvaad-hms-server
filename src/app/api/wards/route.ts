import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok, created } from "@/server/http/response";
import { readJson } from "@/server/http/query";
import { requirePermission } from "@/server/auth/server";
import { listWards, createWard } from "@/server/services/wards-service";

export const GET = withRoute(async () => {
  await requirePermission("beds", "read");
  return ok(await listWards());
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("beds", "write");
  return created(await createWard(await readJson(req), session));
});
