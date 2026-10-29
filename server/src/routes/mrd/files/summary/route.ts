import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { fileSummary } from "@/services/mrd-files-service";

/** Available · checked out · in transit · overdue · pending requests · archived. */
export const GET = withRoute(async () => ok(await fileSummary(await requirePermission("mrd", "read"))));
