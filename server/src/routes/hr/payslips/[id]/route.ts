import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { adjustPayslip } from "@/services/hr-payroll-service";

/** { lopAdjust?, otherDeduction? } on a draft run's payslip. */
export const PATCH = actionRoute("payroll", "write", async (req, ctx, session) =>
  ok(await adjustPayslip(parseId((await ctx.params).id), await readJson(req), session)));
