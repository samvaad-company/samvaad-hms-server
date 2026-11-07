/** The loyalty programme: its cards, prices, colours and scoring rules. Anyone signed in reads it; only an administrator changes it. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession, requirePermission } from "@/auth/server";
import { getProgram, saveProgram } from "@/services/loyalty-service";

export const GET = withRoute(async () => ok(await getProgram(await requireSession())));

const update = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("admin", "write");
  return ok(await saveProgram(await readJson(req), session));
});
export const PUT = update;
export const PATCH = update;
