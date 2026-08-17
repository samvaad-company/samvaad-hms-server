/**
 * Sends a chat message and streams the AI's reply back as SSE
 * (event: tool | text | done). Not a collectionRoute/itemRoute since it
 * returns a stream, not a JSON envelope — see streamReply in
 * ai-chat-service.ts for the tool-calling loop that produces it.
 */
import { type NextRequest, NextResponse } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { requirePermission } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import { BadRequestError } from "@/server/lib/errors";
import { streamReply } from "@/server/services/ai-chat-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("chat", "write");
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new BadRequestError("Message text is required");

  const stream = await streamReply(parseId(id), text, session);
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
