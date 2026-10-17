import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listIvLines, startIvLine } from "@/services/nurse-station-service";

export const GET = withRoute(async () => ok(await listIvLines(await requirePermission("nursing", "read"))));
export const POST = withRoute(async (req: ApiRequest) => created(await startIvLine(await readJson(req), await requirePermission("nursing", "write"))));
