import { type ApiRequest, ApiResponse } from "@/http/web";
import { withRoute } from "@/http/handler";
import { verifyWebhookSignature } from "@/services/payment-gateway";
import { processWebhookEvent } from "@/services/teleconsult-payments";
import { logger } from "@/lib/logger";

const MAX_BODY_BYTES = 1_000_000;

/**
 * Razorpay → server. Authenticated by the signature over the RAW body (so the
 * body is read as text and only parsed once the signature checks out).
 *
 *  - bad/missing signature        → 401 (Razorpay marks the delivery failed)
 *  - handled, duplicate or unknown → 200, so Razorpay stops resending
 *  - our own trouble (database, gateway lookup) → 500, so Razorpay retries later;
 *    every step is idempotent, so a retry never double-books or double-refunds
 *
 * Register: payment.captured, payment.authorized, payment.failed, order.paid, refund.processed.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return ApiResponse.json({ error: { code: "BAD_REQUEST", message: "Body too large" } }, { status: 413 });
  if (!verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    logger.warn("razorpay.webhook.bad_signature", { bytes: raw.length });
    return ApiResponse.json({ error: { code: "UNAUTHORIZED", message: "Bad signature" } }, { status: 401 });
  }
  let body: Parameters<typeof processWebhookEvent>[0];
  try {
    body = JSON.parse(raw);
  } catch {
    return ApiResponse.json({ error: { code: "BAD_REQUEST", message: "Body isn't JSON" } }, { status: 400 });
  }
  const eventId = req.headers.get("x-razorpay-event-id");
  const outcome = await processWebhookEvent(body, eventId);
  logger.info("razorpay.webhook", { event: body.event, eventId, outcome });
  return ApiResponse.json({ ok: true, outcome });
});
