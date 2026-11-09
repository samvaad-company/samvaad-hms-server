/** Send the form to its doctor for signing. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { submitForm } from "@/services/preauth-service";

type Ctx = { params: Promise<{ id: string }> };
export const POST = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await submitForm(parseId((await ctx.params).id), await requireSession())));
