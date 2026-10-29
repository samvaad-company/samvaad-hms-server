import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { codingSummary } from "@/services/mrd-coding-service";

export const GET = withRoute(async () => ok(await codingSummary(await requirePermission("mrd", "read"))));
