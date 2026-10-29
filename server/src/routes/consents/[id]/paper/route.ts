import { type ApiRequest } from "@/http/web";
import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { signOnPaper } from "@/services/consents-service";

/** multipart/form-data: name, relation, witness, signedOn, file (the scanned signed copy, optional). */
export const POST = actionRoute("consents", "write", async (req: ApiRequest, ctx, session) => {
  const form = await req.formData();
  const file = form.get("file");
  const field = (k: string) => { const v = form.get(k); return typeof v === "string" ? v : undefined; };
  return ok(
    await signOnPaper(
      parseId((await ctx.params).id),
      { name: field("name"), relation: field("relation"), witness: field("witness"), signedOn: field("signedOn") || undefined },
      file instanceof File && file.size > 0 ? file : null,
      session,
    ),
  );
});
