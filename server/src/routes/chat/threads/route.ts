import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { paginated, created, makePaginationMeta } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { listThreads, createThread } from "@/services/ai-chat-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("chat", "read");
  const { rows, total } = await listThreads(session);
  return paginated(rows, makePaginationMeta(1, rows.length, total));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("chat", "write");
  return created(await createThread(await readJson(req), session));
});
