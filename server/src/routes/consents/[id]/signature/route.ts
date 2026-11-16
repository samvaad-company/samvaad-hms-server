import { type ApiRequest } from "@/http/web";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { signWithUploadedSignature } from "@/services/consents-service";

/** { name, relation?, witness?, signature }: sign the consent with a picture of the patient's signature (a PNG data URL). */
export const POST = actionRoute("consents", "write", async (req: ApiRequest, ctx, session) =>
  ok(await signWithUploadedSignature(parseId((await ctx.params).id), await readJson(req), session)));
