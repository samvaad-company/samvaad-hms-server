import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { previewConflicts } from "@/services/ot-service";

/** Check a proposed slot (room, time, team, equipment) without booking it. */
export const POST = withRoute(async (req: ApiRequest) => ok(await previewConflicts(await readJson(req), await requirePermission("ot", "read"))));
