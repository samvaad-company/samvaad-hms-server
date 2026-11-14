/** The batches of one medicine that still hold stock, earliest expiry first: what a bill or sale line can choose from. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { NotFoundError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { pharmacyRepo } from "@/repositories";
import { assertOwnedByHospital } from "@/services/hospital-scope";
import { itemBatches } from "@/services/pharmacy-batch-service";
import type { PharmacyItemRow } from "@/db/tables";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req, ctx: Ctx) => {
  const session = await requirePermission("pharmacy", "read");
  const item = await pharmacyRepo.getRow(parseId((await ctx.params).id));
  if (!item) throw new NotFoundError("Pharmacy item");
  assertOwnedByHospital(item as PharmacyItemRow, session);
  return ok(await itemBatches(item as PharmacyItemRow, session));
});
