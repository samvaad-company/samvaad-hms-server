import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { parseId } from "@/http/crud";
import { respondToLink } from "@/services/hospital-lab-links-service";

type Ctx = { params: Promise<{ id: string }> };

/** Lab center accepts or rejects a pending link request. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await respondToLink(parseId(id), await readJson(req), session));
});
