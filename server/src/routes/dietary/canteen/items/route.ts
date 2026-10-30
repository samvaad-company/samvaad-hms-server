import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { addCanteenItem } from "@/services/dietary-service";

/** { name, price } */
export const POST = actionRoute("ipd", "write", async (req, _ctx, session) => created(await addCanteenItem(await readJson(req), session)));
