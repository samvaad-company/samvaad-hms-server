import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { finalizeRun } from "@/services/hr-payroll-service";

export const POST = actionRoute("payroll", "write", async (_req, ctx, session) => ok(await finalizeRun(parseId((await ctx.params).id), session)));
