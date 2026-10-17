import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listTasks, createTask } from "@/services/nurse-station-service";

const sp = (req: ApiRequest) => new URL(req.url).searchParams;

/** ?status=To do | Done (Done is today's) */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("nursing", "read");
  return ok(await listTasks(session, sp(req).get("status") === "Done" ? "Done" : "To do"));
});

export const POST = withRoute(async (req: ApiRequest) => created(await createTask(await readJson(req), await requirePermission("nursing", "write"))));
