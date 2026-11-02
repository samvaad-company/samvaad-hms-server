import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { startTransport } from "@/services/ambulance-service";

/** At scene → Transporting. */
export const POST = actionRoute("ambulance", "write", async (_req, ctx, session) => ok(await startTransport(parseId((await ctx.params).id), session)));
