import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { searchStock } from "@/services/dispense-service";

/** ?q= — medicines in date and on the shelf that match; empty lists the first few. */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("pharmacy", "read");
  return ok(await searchStock(new URL(req.url).searchParams.get("q"), session));
});
