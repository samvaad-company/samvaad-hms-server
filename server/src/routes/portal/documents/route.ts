import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { BadRequestError } from "@/lib/errors";
import { portalUpload } from "@/services/portal-records-service";

/**
 * Patient app: the patient uploads a paper. multipart/form-data with `patientId`, `file`, `category`, `title?`, `note?`.
 * One file per request. PDF or photo (judged by the file's content), up to 10 MB. It is kept as "pending" until staff look at it.
 */
export const POST = withRoute(async (req: ApiRequest) => {
  requirePortalKey(req);
  const form = await req.formData().catch(() => null);
  if (!form) throw new BadRequestError("Send the file as multipart/form-data");
  const file = form.get("file");
  if (!(file instanceof File)) throw new BadRequestError("Choose a file to upload");
  return created(await portalUpload(portalPatientId(form.get("patientId")), file, { category: form.get("category"), title: form.get("title"), note: form.get("note") }));
});

