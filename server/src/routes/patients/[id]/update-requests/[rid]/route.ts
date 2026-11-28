import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { decideRequest } from "@/services/portal-profile-service";

/** Staff: apply or reject one of the patient's change requests. Body `{ decision: "apply" | "reject", note? }` (a note is needed to reject). */
export const POST = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string; rid: string }> }) => {
  const session = await requirePermission("patients", "write");
  return ok(await decideRequest(parseId((await ctx.params).rid), await readJson(req), session));
});
