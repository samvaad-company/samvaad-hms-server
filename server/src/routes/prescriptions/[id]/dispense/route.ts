import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { dispensePrescription } from "@/services/prescriptions-service";

export const POST = actionRoute("prescriptions", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await dispensePrescription(parseId(id), session));
});
