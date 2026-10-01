/**
 * Generates a structured SOAP brief from a raw transcript via Gemini (or a
 * local heuristic when no API key is configured).
 */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { summarizeBrief } from "@/server/services/gemini-scribe";

export const POST = withRoute(async (req: NextRequest) => {
  await requirePermission("scribe", "write");
  const body = (await readJson(req)) as { transcript?: string };
  const result = await summarizeBrief(body?.transcript ?? "");
  return ok(result);
});
