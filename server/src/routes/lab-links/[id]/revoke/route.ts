import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { parseId } from "@/http/crud";
import { revokeLink } from "@/services/hospital-lab-links-service";

type Ctx = { params: Promise<{ id: string }> };

/** Either side of a link (or a platform admin) can revoke it. */
export const POST = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await revokeLink(parseId(id), session));
});
