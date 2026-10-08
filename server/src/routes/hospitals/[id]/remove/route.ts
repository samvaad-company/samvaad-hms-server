import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { removeHospital } from "@/services/hospitals-service";

/** Soft-remove only — status flips to "Removed", no data is deleted. */
export const POST = actionRoute("admin", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await removeHospital(parseId(id), session));
});
