import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { copyRosterWeek } from "@/services/hr-roster-service";

/** { fromStart, toStart } — copy one week's roster onto another. */
export const POST = actionRoute("hr", "write", async (req, _ctx, session) => ok(await copyRosterWeek(await readJson(req), session)));
