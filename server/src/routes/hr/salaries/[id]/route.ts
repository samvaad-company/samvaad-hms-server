import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute, parseId } from "@/http/crud";
import { setSalary } from "@/services/hr-payroll-service";

/** Set a staff member's salary structure (the id is the staff id). */
export const PUT = actionRoute("payroll", "write", async (req, ctx, session) =>
  ok(await setSalary(parseId((await ctx.params).id), await readJson(req), session)));
