import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listRooms, createRoom } from "@/services/ot-resources-service";

export const GET = withRoute(async () => ok(await listRooms(await requirePermission("ot", "read"))));
export const POST = withRoute(async (req: ApiRequest) => created(await createRoom(await readJson(req), await requirePermission("ot", "write"))));
