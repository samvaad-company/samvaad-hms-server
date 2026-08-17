import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok, noContent } from "@/server/http/response";
import { readJson } from "@/server/http/query";
import { requirePermission } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import { getThread, renameThread, deleteThread } from "@/server/services/ai-chat-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "read");
  const { id } = await ctx.params;
  return ok(await getThread(parseId(id), session));
});

export const PATCH = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  return ok(await renameThread(parseId(id), await readJson(req), session));
});

export const DELETE = withRoute(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  await deleteThread(parseId(id), session);
  return noContent();
});
