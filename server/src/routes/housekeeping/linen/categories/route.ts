import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { addLinenCategory } from "@/services/housekeeping-service";

/** { name, unit?, reorderAt? } */
export const POST = actionRoute("beds", "write", async (req, _ctx, session) => created(await addLinenCategory(await readJson(req), session)));
