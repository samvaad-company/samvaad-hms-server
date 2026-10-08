import { type ApiRequest } from "@/http/web";
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { setConsultLink } from "@/services/teleconsult-service";

/** Paste a video link by hand when Google Meet isn't connected or failed. */
export const PUT = actionRoute("teleconsult", "write", async (req: ApiRequest, ctx, session) => {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await setConsultLink(parseId(id), body, session));
});
