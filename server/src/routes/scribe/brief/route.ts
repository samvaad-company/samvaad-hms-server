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
import { budgetMessage, budgetState, recordFeatureUsage } from "@/services/ai-budget-service";

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("scribe", "write");
  const body = (await readJson(req)) as { transcript?: string };
  const state = await budgetState(session.hospitalId, "scribe");
  const result = await summarizeBrief(body?.transcript ?? "", state.exceeded ? { offline: budgetMessage("scribe", state) } : {});
  if (result.usage) await recordFeatureUsage({ hospitalId: session.hospitalId, feature: "scribe", usage: result.usage, userId: session.userId, userName: session.name });
  return ok({ brief: result.brief, mock: result.mock, reason: result.reason, detail: result.detail });
});
