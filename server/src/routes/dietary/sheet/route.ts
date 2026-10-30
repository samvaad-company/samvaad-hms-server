import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { generateSheet } from "@/services/dietary-service";

/** { date?, wardId } — write the sheet's lines (again: only what's missing is added). */
export const POST = actionRoute("ipd", "write", async (req, _ctx, session) => ok(await generateSheet(await readJson(req), session)));
