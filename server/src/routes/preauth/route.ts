/** GET ?status=&patientId=&search= lists this hospital's pre-auth forms; POST { formKey, patientId, admissionId?, doctorId? } makes one. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created, ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { createForm, listForms } from "@/services/preauth-service";

export const GET = withRoute(async (req: ApiRequest) => ok(await listForms(new URL(req.url, "http://localhost").searchParams, await requireSession())));
export const POST = withRoute(async (req: ApiRequest) => created(await createForm(await readJson(req), await requireSession())));
