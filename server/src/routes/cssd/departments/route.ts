import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { cssdDepartments } from "@/services/cssd-service";

export const GET = withRoute(async () => ok(await cssdDepartments(await requirePermission("cssd", "read"))));
