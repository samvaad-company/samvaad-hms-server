/** Publish a draft (or re-publish a cancelled programme): patients are notified in the portal. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { publishAwareness } from "@/services/awareness-service";

type Ctx = { params: Promise<{ id: string }> };
export const POST = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await publishAwareness(parseId((await ctx.params).id), await requirePermission("awareness", "write"))));
