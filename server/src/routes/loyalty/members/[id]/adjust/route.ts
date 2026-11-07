/** Adds or takes off points by hand: `{ points: 10, reason: "Referred three patients" }` (a negative number takes points off). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { adjustPoints } from "@/services/loyalty-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("admin", "write");
  const { id } = await ctx.params;
  return created(await adjustPoints(parseId(id), await readJson(req), session));
});
