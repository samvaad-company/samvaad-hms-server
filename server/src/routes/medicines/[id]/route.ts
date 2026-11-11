import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { setMedicinePrice } from "@/services/admin-service";

type Ctx = { params: Promise<{ id: string }> };

/** Setup → Masters → Medicines: set (or clear) the price charged for a medicine. */
const update = withRoute(async (req, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  return ok(await setMedicinePrice(parseId((await ctx.params).id), await readJson(req), session));
});
export const PATCH = update;
export const PUT = update;
