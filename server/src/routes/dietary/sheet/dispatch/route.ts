import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { dispatchSheet } from "@/services/dietary-service";

/** { date?, wardId } — Draft → Dispatched. */
export const POST = actionRoute("ipd", "write", async (req, _ctx, session) => ok(await dispatchSheet(await readJson(req), session)));
