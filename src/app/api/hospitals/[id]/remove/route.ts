import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { removeHospital } from "@/server/services/hospitals-service";

/** Soft-remove only — status flips to "Removed", no data is deleted. */
export const POST = actionRoute("admin", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await removeHospital(parseId(id), session));
});
