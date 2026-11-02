/**
 * Sets a monthly AI token limit: `{ limit }` for the hospital default, `{ userId, limit }` for one person,
 * `{ userId, limit: null }` to put that person back on the default. Super admin only (checked in the service).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { setLimit } from "@/services/ai-quota-service";

export const PUT = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  await setLimit(await readJson(req), session);
  return ok({ saved: true });
});
