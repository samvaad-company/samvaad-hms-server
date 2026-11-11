import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { addStarterServices } from "@/services/billing-catalog-service";

/** { type: "Pharmacy" | "Radiology" | "Blood" | "Ambulance" } — puts starter services for that type of bill into Setup → Masters. */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("admin", "write");
  return ok(await addStarterServices(((await readJson(req)) as { type?: unknown } | null)?.type, session));
});
