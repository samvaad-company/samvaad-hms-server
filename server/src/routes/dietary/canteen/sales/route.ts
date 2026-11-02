import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { recordSale } from "@/services/dietary-service";

/** { itemId, quantity, buyerType?, buyer? } */
export const POST = actionRoute("ipd", "write", async (req, _ctx, session) => created(await recordSale(await readJson(req), session)));
