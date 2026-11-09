/** The treating doctor signs the form with the signature they keep. Optional { values } carries the declaration details (qualification, registration no.). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { signForm } from "@/services/preauth-service";

type Ctx = { params: Promise<{ id: string }> };
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await signForm(parseId((await ctx.params).id), await readJson(req).catch(() => ({})), await requireSession())));
