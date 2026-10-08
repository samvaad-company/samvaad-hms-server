import { type ApiRequest } from "@/http/web";
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { retryMeetLink } from "@/services/teleconsult-service";

/** Create the Google Meet link for a tele-consult. Body `{ "replace": true }` makes a fresh room even if one exists. */
export const POST = actionRoute("teleconsult", "write", async (req: ApiRequest, ctx, session) => {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { replace?: unknown };
  return ok(await retryMeetLink(parseId(id), session, body.replace === true));
});
