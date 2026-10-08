/**
 * Online payment gateway for tele-consult fees (Razorpay over its REST API).
 *
 * Modes:
 *  - "razorpay": RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET are set — real orders.
 *  - "mock":     no keys and NOT production — a fake gateway so the whole flow
 *                can be exercised locally. A mock payment is accepted with the
 *                signature "mock"; this mode can never activate in production.
 *  - "off":      no keys in production — paying online is unavailable.
 *
 * Every call has a timeout. Reads (fetch a payment, list an order's payments)
 * are retried on network errors and 5xx; writes are not retried here because the
 * callers make them idempotent in their own way (a refund that was "already
 * refunded" counts as done, a capture of an already-captured payment is fine).
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/errors";
import { getConfig } from "@/config/env";
import { logger } from "@/lib/logger";

export type GatewayMode = "razorpay" | "mock" | "off";

const API_BASE = "https://api.razorpay.com/v1";
const TIMEOUT_MS = 10_000;

export function gatewayMode(): GatewayMode {
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) return "razorpay";
  return getConfig().isProduction ? "off" : "mock";
}

/** The public key id the payment sheet needs; null in mock/off mode. */
export function publicKeyId(): string | null {
  return gatewayMode() === "razorpay" ? process.env.RAZORPAY_KEY_ID! : null;
}

/** Log (once, at startup) anything that would make payments quietly fail in production. */
export function checkGatewayConfig(): void {
  const hasKeys = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (hasKeys && !process.env.RAZORPAY_WEBHOOK_SECRET) {
    logger.warn("payments.webhook_secret_missing", {
      hint: "Set RAZORPAY_WEBHOOK_SECRET — without it Razorpay's webhook is rejected and only the portal's own confirmation works.",
    });
  }
  if (hasKeys && (process.env.RAZORPAY_WEBHOOK_SECRET ?? "").length < 16) {
    logger.warn("payments.webhook_secret_weak", {
      hint: "RAZORPAY_WEBHOOK_SECRET is short; anyone who guesses it can forge payment confirmations. Use a long random value.",
    });
  }
  if (!hasKeys && getConfig().isProduction) {
    logger.warn("payments.gateway_off", { hint: "No Razorpay keys in production — online payment is unavailable." });
  }
}

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

const basicAuth = () =>
  "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface RazorpayErrorBody { error?: { code?: string; description?: string } }

/** Error from the gateway with its HTTP status and Razorpay's description, so callers can tell "refused" from "unreachable". */
export class GatewayError extends AppError {
  readonly httpStatus: number;
  readonly description: string;
  constructor(httpStatus: number, description: string) {
    super(502, "INTERNAL", description || `Payment gateway error (${httpStatus})`);
    this.name = "GatewayError";
    this.httpStatus = httpStatus;
    this.description = description;
  }
  /** True when retrying later could succeed (network trouble, 5xx, rate limit). */
  get transient(): boolean {
    return this.httpStatus === 0 || this.httpStatus >= 500 || this.httpStatus === 429;
  }
}

async function call<T>(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<T> {
  const attempts = method === "GET" ? 3 : 1;
  let last: GatewayError | null = null;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(250 * i);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const json = (await res.json().catch(() => ({}))) as T & RazorpayErrorBody;
      if (res.ok) return json;
      last = new GatewayError(res.status, json.error?.description ?? "");
      if (!last.transient) throw last;
    } catch (err) {
      if (err instanceof GatewayError) {
        last = err;
        if (!err.transient) throw err;
      } else {
        last = new GatewayError(0, err instanceof Error && err.name === "TimeoutError" ? "The payment gateway timed out" : "Couldn't reach the payment gateway");
      }
    }
  }
  throw last ?? new GatewayError(0, "Couldn't reach the payment gateway");
}

export interface GatewayOrder {
  id: string;
  /** Smallest currency unit (paise). */
  amount: number;
  currency: string;
}

/**
 * Create a payment order for an amount in INR (main units). The amount is the
 * caller's, so it must come from the server. `notes` ride on the order and come
 * back on every payment/webhook, which lets us find the booking even if the
 * order id lookup ever misses.
 */
export async function createOrder(amountInr: number, receipt: string, notes: Record<string, string> = {}): Promise<GatewayOrder> {
  const mode = gatewayMode();
  if (mode === "off") throw new AppError(503, "INTERNAL", "Online payments aren't configured for this hospital yet");
  const amount = Math.round(amountInr * 100);
  if (mode === "mock") {
    return { id: `mock_order_${receipt}_${Date.now().toString(36)}`, amount, currency: "INR" };
  }
  const order = await call<{ id: string; amount: number; currency: string }>("POST", "/orders", {
    amount,
    currency: "INR",
    receipt: receipt.slice(0, 40),
    notes,
  });
  return { id: order.id, amount: order.amount, currency: order.currency };
}

/** A payment as Razorpay reports it (only what we use). */
export interface GatewayPayment {
  id: string;
  order_id: string | null;
  /** Paise. */
  amount: number;
  currency: string;
  /** created | authorized | captured | refunded | failed */
  status: string;
  method?: string;
  email?: string;
  contact?: string;
  captured?: boolean;
  error_code?: string | null;
  error_description?: string | null;
  notes?: Record<string, string> | unknown[];
}

export async function fetchPayment(paymentId: string): Promise<GatewayPayment> {
  return call<GatewayPayment>("GET", `/payments/${encodeURIComponent(paymentId)}`);
}

/** All payment attempts made against one order (a patient may retry after a failure). */
export async function listOrderPayments(orderId: string): Promise<GatewayPayment[]> {
  const res = await call<{ items?: GatewayPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
  return res.items ?? [];
}

/** Capture an authorized payment (needed when the account isn't set to auto-capture). */
export async function capturePayment(paymentId: string, amountPaise: number, currency = "INR"): Promise<GatewayPayment> {
  try {
    return await call<GatewayPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency });
  } catch (err) {
    // Another process (or Razorpay's auto-capture) got there first — that's the outcome we wanted.
    if (err instanceof GatewayError && /already.*captured/i.test(err.description)) return fetchPayment(paymentId);
    throw err;
  }
}

/** Check the payment signature the checkout returns: HMAC-SHA256("order_id|payment_id"). */
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const mode = gatewayMode();
  if (mode === "mock") return signature === "mock" && orderId.startsWith("mock_order_");
  if (mode !== "razorpay") return false;
  if (!orderId || !paymentId || !signature) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Check a webhook delivery against the RAW request body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}

export interface RefundResult {
  refunded: boolean;
  reference: string;
}

/**
 * Refund a captured payment in full. Safe to call twice: if Razorpay says it was
 * already refunded, that is reported as done. Mock mode pretends to, so the flow
 * can be exercised without a gateway.
 */
export async function refundPayment(paymentId: string, amountInr: number): Promise<RefundResult> {
  const mode = gatewayMode();
  if (mode === "mock") return { refunded: true, reference: `mock_refund_${paymentId}` };
  if (mode !== "razorpay") return { refunded: false, reference: "" };
  try {
    const refund = await call<{ id: string }>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: Math.round(amountInr * 100),
    });
    return { refunded: true, reference: refund.id };
  } catch (err) {
    if (err instanceof GatewayError && /already.*(refund|full)|fully refunded/i.test(err.description)) {
      return { refunded: true, reference: `already_refunded_${paymentId}` };
    }
    throw err;
  }
}
