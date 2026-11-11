/** Adds an Aadhaar card, PAN card or policy (multipart: file, kind) to the form's patient, for the packet. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { created } from "@/http/response";
import { parseId } from "@/http/crud";
import { BadRequestError } from "@/lib/errors";
import { requireSession } from "@/auth/server";
import { uploadPacketDocument } from "@/services/preauth-packet-service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requireSession();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new BadRequestError("Missing file");
  return created(await uploadPacketDocument(parseId((await ctx.params).id), form.get("kind"), file, session));
});
