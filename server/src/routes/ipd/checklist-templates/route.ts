import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listTemplates, createTemplate } from "@/services/checklists-service";

/** Templates, each with `lines` — the text form used by the editor ("Label*", "> sub-line"). */
export const GET = withRoute(async () => ok(await listTemplates(await requirePermission("nursing", "read"))));
export const POST = withRoute(async (req: ApiRequest) => created(await createTemplate(await readJson(req), await requirePermission("nursing", "write"))));
