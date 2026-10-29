import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listEquipment, createEquipment } from "@/services/ot-resources-service";

export const GET = withRoute(async () => ok(await listEquipment(await requirePermission("ot", "read"))));
export const POST = withRoute(async (req: ApiRequest) => created(await createEquipment(await readJson(req), await requirePermission("ot", "write"))));
