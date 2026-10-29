import { type ApiRequest } from "@/http/web";
import { actionRoute, parseId } from "@/http/crud";
import { created } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { uploadDocument } from "@/services/documents-service";

/** multipart/form-data: file, patientId, category — files the upload in this folder, attached to the patient. */
export const POST = actionRoute("mrd", "write", async (req: ApiRequest, ctx, session) => {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new BadRequestError("Missing file");
  return created(
    await uploadDocument(
      { file, ownerType: "patient", ownerId: Number(form.get("patientId")), category: (form.get("category") as string) || undefined, folderId: parseId((await ctx.params).id) },
      session,
    ),
  );
});
