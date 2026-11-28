/** Every bill of one stay and what is still to pay, for the discharge screen (nurses and doctors can read it without billing access). */
import { actionRoute, parseId } from "@/http/crud";
import { ok } from "@/http/response";
import { stayBills } from "@/services/ipd-clearance-service";

export const GET = actionRoute("ipd", "read", async (_req, ctx, session) => ok(await stayBills(parseId((await ctx.params).id), session)));
