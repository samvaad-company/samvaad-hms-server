import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { getOwnCenter, updateOwnCenter } from "@/server/services/lab-centers-service";

/** A lab center's own settings — the service rejects non-center accounts. */
export const GET = withRoute(async () => {
  const session = await requirePermission("lab", "read");
  return ok(await getOwnCenter(session));
});

const update = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("lab", "write");
  return ok(await updateOwnCenter(await readJson(req), session));
});

export const PUT = update;
export const PATCH = update;
