import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { receiveSheet } from "@/services/dietary-service";

/** { date?, wardId } — the ward confirms the sheet's meals arrived: Dispatched → Received. */
export const POST = actionRoute("ipd", "write", async (req, _ctx, session) => ok(await receiveSheet(await readJson(req), session)));
