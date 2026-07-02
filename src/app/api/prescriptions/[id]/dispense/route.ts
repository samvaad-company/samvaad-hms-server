import { actionRoute, parseId } from "@/server/http/crud";
import { ok } from "@/server/http/response";
import { dispensePrescription } from "@/server/services/prescriptions-service";

export const POST = actionRoute("prescriptions", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await dispensePrescription(parseId(id), session));
});
