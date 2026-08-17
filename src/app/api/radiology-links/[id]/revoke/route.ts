import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import { revokeLink } from "@/server/services/hospital-radiology-links-service";

type Ctx = { params: Promise<{ id: string }> };

/** Either side of a link (or a platform admin) can revoke it. */
export const POST = withRoute(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await revokeLink(parseId(id), session));
});
