/**
 * Pauses or resumes one person's AI use: `{ userId, blocked }`. Super admin and admin only (checked in the service).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { setAccess } from "@/services/ai-quota-service";

export const PUT = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  await setAccess(await readJson(req), session);
  return ok({ saved: true });
});
