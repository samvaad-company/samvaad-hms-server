/** Adds the patient's signature picture to a form, or takes it off. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { setPatientSignature } from "@/services/preauth-service";

type Ctx = { params: Promise<{ id: string }> };
/** { image: "data:image/png;base64,…" } to add it, { image: null } to remove it. */
export const PUT = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await setPatientSignature(parseId((await ctx.params).id), await readJson(req), await requireSession())));
