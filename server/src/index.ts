/**
 * Samvaad HMS API server.
 *
 *   npm run dev      # watch mode (http://localhost:4000)
 *   npm start
 *
 * The Next.js frontend proxies `/api/*` here (see `next.config.ts`), so the
 * browser still talks to a single origin and the session cookie just works.
 */
import { serve } from "@hono/node-server";
import { createApp } from "@/app";
import { logger } from "@/lib/logger";
import { checkGatewayConfig } from "@/services/payment-gateway";
import { startReconciler } from "@/services/teleconsult-payments";

const port = Number(process.env.PORT ?? 4000);
const { app, routes } = await createApp();

serve({ fetch: app.fetch, port }, (info) => {
  logger.info("server.listening", { port: info.port, routes: routes.length });
});

checkGatewayConfig();
// Safety net for payments: finds any the webhook and the patient's own confirmation both missed.
startReconciler();
