import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { paginated, created, makePaginationMeta } from "@/server/http/response";
import { readJson } from "@/server/http/query";
import { requirePermission } from "@/server/auth/server";
import { listThreads, createThread } from "@/server/services/ai-chat-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("chat", "read");
  const { rows, total } = await listThreads(session);
  return paginated(rows, makePaginationMeta(1, rows.length, total));
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("chat", "write");
  return created(await createThread(await readJson(req), session));
});
