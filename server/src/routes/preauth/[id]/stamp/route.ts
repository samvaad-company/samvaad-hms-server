/** The hospital's admin stamps a form the doctor has signed. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { stampForm } from "@/services/preauth-service";

type Ctx = { params: Promise<{ id: string }> };
export const POST = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await stampForm(parseId((await ctx.params).id), await requireSession())));
