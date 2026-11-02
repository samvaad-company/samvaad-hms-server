/**
 * Gives one person extra AI tokens for the current month: `{ userId, tokens, note? }`. Super admin only (checked in the service).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { requireSession } from "@/auth/server";
import { grantTokens } from "@/services/ai-quota-service";

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  await grantTokens(await readJson(req), session);
  return created({ saved: true });
});
