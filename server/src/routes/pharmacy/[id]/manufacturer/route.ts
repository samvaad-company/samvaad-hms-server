/** Setup → Masters → Manufacturers: move a medicine to another manufacturer (`{ manufacturerId }`, or null for none). */
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { audit } from "@/services/audit";
import { setItemManufacturer } from "@/services/pharmacy-parties-service";

type Ctx = { params: Promise<{ id: string }> };

const update = withRoute(async (req, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const body = (await readJson(req)) as { manufacturerId?: unknown };
  const raw = body?.manufacturerId;
  const manufacturerId = raw === null || raw === "" ? null : Number(raw);
  if (manufacturerId !== null && (!Number.isInteger(manufacturerId) || manufacturerId < 1)) throw new ValidationError([{ field: "manufacturerId", message: "choose a manufacturer from the list, or none" }]);
  const itemId = parseId((await ctx.params).id);
  const row = await setItemManufacturer(itemId, manufacturerId, session);
  if (row === null) throw new NotFoundError("Pharmacy item");
  if (row === undefined) throw new ValidationError([{ field: "manufacturerId", message: "that manufacturer no longer exists" }]);
  await audit(session, "update", "pharmacy", itemId, { manufacturerId });
  return ok({ id: itemId, manufacturer: row.manufacturer ?? "" });
});
export const PATCH = update;
export const PUT = update;
