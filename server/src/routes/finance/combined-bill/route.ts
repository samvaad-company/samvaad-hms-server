/** GET ?patientId=&from=&to= — a preview of the statement. POST { patientId, from?, to? } — issue it: saved with its invoice number. */
import { withRoute } from "@/http/handler";
import { created, ok } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { combinedBill, issueCombinedBill } from "@/services/combined-bill-service";

export const GET = withRoute(async (req) => {
  const session = await requirePermission("billing", "read");
  return ok(await combinedBill(new URL(req.url, "http://localhost").searchParams, session));
});

export const POST = withRoute(async (req) => {
  const session = await requirePermission("billing", "add");
  return created(await issueCombinedBill(await readJson(req), session));
});
