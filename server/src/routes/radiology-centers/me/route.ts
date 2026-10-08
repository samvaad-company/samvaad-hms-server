import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getOwnCenter, updateOwnCenter } from "@/services/radiology-centers-service";

/** A radiology center's own settings — the service rejects non-center accounts. */
export const GET = withRoute(async () => {
  const session = await requirePermission("radiology", "read");
  return ok(await getOwnCenter(session));
});

const update = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("radiology", "write");
  return ok(await updateOwnCenter(await readJson(req), session));
});

export const PUT = update;
export const PATCH = update;
