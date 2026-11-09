/** Hospital staff: GET ?status=&category=&search= lists this hospital's awareness programmes; POST makes one (`publish: true` posts it straight away). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created, ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { createAwareness, listAwareness } from "@/services/awareness-service";

export const GET = withRoute(async (req: ApiRequest) => ok(await listAwareness(new URL(req.url, "http://localhost").searchParams, await requirePermission("awareness", "read"))));
export const POST = withRoute(async (req: ApiRequest) => created(await createAwareness(await readJson(req), await requirePermission("awareness", "write"))));
