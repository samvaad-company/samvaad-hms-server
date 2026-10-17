import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listDoses, recordDose } from "@/services/nurse-station-service";

const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** ?date=yyyy-mm-dd (default today) — every scheduled dose that day, with what became of it. */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("nursing", "read");
  const ward = Number(sp(req).get("wardId"));
  return ok(await listDoses(session, sp(req).get("date") ?? undefined, Number.isInteger(ward) && ward > 0 ? ward : undefined));
});

/** { medicationId, scheduledAt, status: "Given" | "Held", note? } */
export const POST = withRoute(async (req: ApiRequest) => created(await recordDose(await readJson(req), await requirePermission("nursing", "write"))));
