/** GET: what the hospital already knows for one admission's claim form (patient, policy, stay, hospital, doctor, bill). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { getDraft } from "@/services/claim-forms-service";

type Ctx = { params: Promise<{ admissionId: string }> };

export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getDraft(parseId((await ctx.params).admissionId), await requireSession())));
