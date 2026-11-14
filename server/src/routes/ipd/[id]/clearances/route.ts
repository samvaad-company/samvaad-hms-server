/** GET — what each department has said about this discharge. POST { department? } — ask the departments (or ask one again after the patient has paid). */
import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { listClearances, requestClearances } from "@/services/ipd-clearance-service";

export const GET = actionRoute("ipd", "read", async (_req, ctx, session) => ok(await listClearances(parseId((await ctx.params).id), session)));
export const POST = actionRoute("ipd", "write", async (req, ctx, session) => ok(await requestClearances(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session)));
