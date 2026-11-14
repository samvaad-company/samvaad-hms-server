/** Setup → Masters → Manufacturers: the medicines in the inventory made by one manufacturer. */
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { manufacturerMedicines } from "@/services/pharmacy-parties-service";

export const GET = actionRoute("pharmacy", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  await requirePermission("admin", "read");
  return ok(await manufacturerMedicines(parseId(id), session));
});
