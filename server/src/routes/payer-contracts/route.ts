import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { listSetup } from "@/services/setup-service";

/** The sponsor contracts a payer can be tied to at registration — names only; the terms stay with Setup (admins) and the billing counter. */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok((await listSetup("contract", session, { activeOnly: true })).map((c) => ({ id: c.id, name: c.name })));
});
