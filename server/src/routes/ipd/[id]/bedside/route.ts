/** Medicines a nurse or doctor takes from the pharmacy to a patient's bed: what has gone so far, and a new delivery. */
import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { deliverToBed, listBedsideDeliveries } from "@/services/dispense-service";

export const GET = actionRoute("ipd", "read", async (_req, ctx, session) => ok(await listBedsideDeliveries(parseId((await ctx.params).id), session)));

export const POST = actionRoute("ipd", "write", async (req, ctx, session) => created(await deliverToBed(parseId((await ctx.params).id), await readJson(req), session)));
