import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { recordExport } from "@/services/audit-trail-service";
import { readJson } from "@/http/query";

/** { format: "csv" | "pdf", count } — the screen builds the file; this puts the export itself on the trail. */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("admin", "read");
  const body = (await readJson(req)) as { format?: string; count?: number };
  await recordExport(body.format === "pdf" ? "pdf" : "csv", Math.max(0, Math.trunc(Number(body.count) || 0)), session);
  return ok({ recorded: true });
});
