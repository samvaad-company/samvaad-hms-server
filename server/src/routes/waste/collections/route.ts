import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { listCollections, logCollection } from "@/services/waste-ic-service";

/** ?from=&to=&wardId=&category=white|red|yellow|blue&limit= */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("cssd", "read");
  const q = new URL(req.url).searchParams;
  return ok(await listCollections({ from: q.get("from") || undefined, to: q.get("to") || undefined, wardId: q.get("wardId") ? Number(q.get("wardId")) : undefined, category: q.get("category") || undefined, limit: Number(q.get("limit")) || undefined }, session));
});

/** { wardId, category, quantityKg, bags?, collectedOn?, collectedTime?, notes? } */
export const POST = withRoute(async (req) => created(await logCollection(await readJson(req), await requirePermission("cssd", "write"))));
