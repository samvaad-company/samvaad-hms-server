import { created } from "@/http/response";
import { readJson } from "@/http/query";
import { actionRoute } from "@/http/crud";
import { logInfection } from "@/services/waste-ic-service";

/** { infectionType, wardId?, patientName?, patientCode?, organism?, deviceProcedure?, eventDate?, notes? } */
export const POST = actionRoute("cssd", "write", async (req, _ctx, session) => created(await logInfection(await readJson(req), session)));
