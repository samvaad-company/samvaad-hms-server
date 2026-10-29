import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { cssdSummary } from "@/services/cssd-service";

export const GET = withRoute(async () => ok(await cssdSummary(await requirePermission("cssd", "read"))));
