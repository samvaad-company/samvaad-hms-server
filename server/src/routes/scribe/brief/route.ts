/**
 * Generates a structured SOAP brief from a raw transcript via Gemini (or a
 * local heuristic when no API key is configured).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { summarizeBrief } from "@/services/gemini-scribe";

export const POST = withRoute(async (req: ApiRequest) => {
  await requirePermission("scribe", "write");
  const body = (await readJson(req)) as { transcript?: string };
  const result = await summarizeBrief(body?.transcript ?? "");
  return ok(result);
});
