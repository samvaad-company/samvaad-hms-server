import { withRoute } from "@/http/handler";
import { ok, created } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { listDisposals, logDisposal } from "@/services/waste-ic-service";

/** The disposals, and how much of each colour is collected but not yet disposed of. */
export const GET = withRoute(async () => ok(await listDisposals(await requirePermission("cssd", "read"))));

/** { category, quantityKg, vendor, manifestNo?, vehicle?, disposedOn?, notes? } — refused if it is more than is waiting. */
export const POST = withRoute(async (req) => created(await logDisposal(await readJson(req), await requirePermission("cssd", "write"))));
