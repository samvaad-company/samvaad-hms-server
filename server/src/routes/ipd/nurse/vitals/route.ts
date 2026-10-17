import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listVitals, latestVitals, recordVitals } from "@/services/nurse-station-service";

const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** ?admissionId=… for one patient's history; without it, the latest set for every admitted patient. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("nursing", "read");
  const id = Number(sp(req).get("admissionId"));
  return ok(Number.isInteger(id) && id > 0 ? await listVitals(id, session) : await latestVitals(session));
});

export const POST = withRoute(async (req: ApiRequest) => created(await recordVitals(await readJson(req), await requirePermission("nursing", "write"))));
