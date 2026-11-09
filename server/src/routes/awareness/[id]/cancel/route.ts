/** Cancel a published programme: the portal shows it as cancelled and tells patients. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { cancelAwareness } from "@/services/awareness-service";

type Ctx = { params: Promise<{ id: string }> };
export const POST = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await cancelAwareness(parseId((await ctx.params).id), await requirePermission("awareness", "write"))));
