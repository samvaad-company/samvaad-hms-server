/** One patient's card: rank, points and how they were earned, referrals, family and the points added by hand. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { getMember } from "@/services/loyalty-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await getMember(parseId(id), session));
});
