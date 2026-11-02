import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { createTask } from "@/services/housekeeping-service";

/** { wardId?, bedId?, location?, assignee?, notes? } — raise an ad hoc cleaning job. */
export const POST = actionRoute("beds", "write", async (req, _ctx, session) => created(await createTask(await readJson(req), session)));
