import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { retentionQueue } from "@/services/mrd-documents-service";

/** Documents past their retention period, with the four due-counts. Runs the sweep first. */
export const GET = withRoute(async () => ok(await retentionQueue(await requirePermission("mrd", "read"))));
