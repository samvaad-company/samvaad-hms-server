import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import { respondToLink } from "@/server/services/hospital-lab-links-service";

type Ctx = { params: Promise<{ id: string }> };

/** Lab center accepts or rejects a pending link request. */
export const POST = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await respondToLink(parseId(id), await readJson(req), session));
});
