/**
 * Sends a chat message and streams the AI's reply back as SSE
 * (event: tool | text | done). Not a collectionRoute/itemRoute since it
 * returns a stream, not a JSON envelope — see streamReply in
 * ai-chat-service.ts for the tool-calling loop that produces it.
 */
import { type ApiRequest, ApiResponse } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { BadRequestError } from "@/lib/errors";
import { streamReply } from "@/services/ai-chat-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new BadRequestError("Message text is required");

  const stream = await streamReply(parseId(id), text, session);
  return new ApiResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
