import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { NotFoundError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { isConfigKey, getConfig, updateConfig } from "@/services/setup-service";

type Ctx = { params: Promise<{ key: string }> };

export const GET = withRoute(async (_req, ctx: Ctx) => {
  const { key } = await ctx.params;
  if (!isConfigKey(key)) throw new NotFoundError("Setting");
  return ok(await getConfig(key, await requirePermission("admin", "read")));
});

const update = withRoute(async (req, ctx: Ctx) => {
  const { key } = await ctx.params;
  if (!isConfigKey(key)) throw new NotFoundError("Setting");
  const session = await requirePermission("admin", "write");
  return ok(await updateConfig(key, await readJson(req), session));
});
export const PUT = update;
export const PATCH = update;
