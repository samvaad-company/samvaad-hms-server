import { ok, noContent } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { getRun, deleteRun } from "@/services/hr-payroll-service";

export const GET = actionRoute("payroll", "read", async (_req, ctx, session) => ok(await getRun(parseId((await ctx.params).id), session)));

export const DELETE = actionRoute("payroll", "write", async (_req, ctx, session) => {
  await deleteRun(parseId((await ctx.params).id), session);
  return noContent();
});
