import { type ApiRequest } from "@/http/web";
import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok, noContent } from "@/http/response";
import {
  getPlatformBill,
  updatePlatformBill,
  deletePlatformBill,
} from "@/services/platform-billing-service";

export const GET = actionRoute("admin", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getPlatformBill(parseId(id), session));
});

const update = actionRoute("admin", "write", async (req: ApiRequest, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await updatePlatformBill(parseId(id), await readJson(req), session));
});

export const PUT = update;
export const PATCH = update;

export const DELETE = actionRoute("admin", "write", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  await deletePlatformBill(parseId(id), session);
  return noContent();
});
