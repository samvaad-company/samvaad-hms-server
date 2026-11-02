import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { recordLinenMove } from "@/services/housekeeping-service";

/** { kind, categoryId, quantity, wardId?, notes? } — one movement on the linen ledger; refused if the source holds too little. */
export const POST = actionRoute("beds", "write", async (req, _ctx, session) => created(await recordLinenMove(await readJson(req), session)));
