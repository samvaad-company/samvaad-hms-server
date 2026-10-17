import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listHandover, addHandover } from "@/services/nurse-station-service";

const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** ?shift=Morning|Evening|Night &date=yyyy-mm-dd — defaults to the shift in progress. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("nursing", "read");
  return ok(await listHandover(session, sp(req).get("shift") ?? undefined, sp(req).get("date") ?? undefined));
});

export const POST = withRoute(async (req: ApiRequest) => created(await addHandover(await readJson(req), await requirePermission("nursing", "write"))));
