import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { addDiet, listDiets } from "@/services/dietary-service";

export const GET = withRoute(async () => ok(await listDiets(await requirePermission("ipd", "read"))));
/** { name, instructions?, meals? } */
export const POST = withRoute(async (req) => created(await addDiet(await readJson(req), await requirePermission("ipd", "write"))));
