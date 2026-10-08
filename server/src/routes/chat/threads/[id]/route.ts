import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok, noContent } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { getThread, renameThread, deleteThread } from "@/services/ai-chat-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "read");
  const { id } = await ctx.params;
  return ok(await getThread(parseId(id), session));
});

export const PATCH = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  return ok(await renameThread(parseId(id), await readJson(req), session));
});

export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  await deleteThread(parseId(id), session);
  return noContent();
});
