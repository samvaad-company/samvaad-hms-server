import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { logHandHygiene } from "@/services/waste-ic-service";

/** { wardId, observed, compliant, auditDate?, notes? } */
export const POST = actionRoute("cssd", "write", async (req, _ctx, session) => created(await logHandHygiene(await readJson(req), session)));
