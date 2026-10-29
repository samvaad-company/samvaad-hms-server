import { ApiResponse } from "@/http/web";
import { withRoute } from "@/http/handler";
import { logger } from "@/lib/logger";
import { processWebhook } from "@/services/whatsapp-bot";
import { verifyChallenge, verifySignature } from "@/services/whatsapp-service";

const text = (body: string, status: number) => new ApiResponse(body, { status, headers: { "content-type": "text/plain" } });

/** Meta's one-time check when the webhook is set up: echo `hub.challenge` if the verify token matches. */
export const GET = withRoute(async (req) => {
  const q = new URL(req.url).searchParams;
  const r = verifyChallenge({ mode: q.get("hub.mode"), token: q.get("hub.verify_token"), challenge: q.get("hub.challenge") });
  if (r.status !== 200) logger.warn("whatsapp.webhook_verification_denied", { status: r.status });
  return text(r.body, r.status);
});

/**
 * Messages and delivery reports from Meta. The signature is checked against the raw body, the reply is a 200 straight away
 * (Meta retries and eventually disables slow webhooks), and the work happens after.
 */
export const POST = withRoute(async (req) => {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    logger.warn("whatsapp.webhook_bad_signature");
    return text("Forbidden", 403);
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch { return text("OK", 200); }
  setImmediate(() => { processWebhook(body).catch((e) => logger.error("whatsapp.webhook_failed", { error: e instanceof Error ? e.message : String(e) })); });
  return text("OK", 200);
});
