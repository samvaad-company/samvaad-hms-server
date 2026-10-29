import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { listDeficiencies, raiseDeficiency } from "@/services/mrd-coding-service";

export const GET = actionRoute("mrd", "read", async (_req, ctx, session) => ok(await listDeficiencies(parseId((await ctx.params).id), session)));

export const POST = actionRoute("mrd", "write", async (req, ctx, session) =>
  created(await raiseDeficiency(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), session)));
