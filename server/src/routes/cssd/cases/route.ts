import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { cssdCases } from "@/services/cssd-service";

export const GET = withRoute(async () => ok(await cssdCases(await requirePermission("cssd", "read"))));
