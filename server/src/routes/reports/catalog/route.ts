import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { CATEGORIES, reportCatalog } from "@/services/report-engine";

/** Every report the Reports screen lists, with the category it sits under and whether this system has the data to run it. */
export const GET = withRoute(async () => {
  await requirePermission("reports", "read");
  return ok({ categories: CATEGORIES, reports: reportCatalog() });
});
