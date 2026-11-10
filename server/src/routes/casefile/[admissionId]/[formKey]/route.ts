/** One form of the case file. POST { data } saves it for the first time; PUT { data, version } saves a change (the version that was loaded). */
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { saveForm } from "@/services/casefile-service";

type Ctx = { params: Promise<{ admissionId: string; formKey: string }> };

export const POST = withRoute(async (req, ctx: Ctx) => {
  const session = await requirePermission("casefile", "write");
  const { admissionId, formKey } = await ctx.params;
  return created(await saveForm(parseId(admissionId), formKey, await readJson(req), session, true));
});

export const PUT = withRoute(async (req, ctx: Ctx) => {
  const session = await requirePermission("casefile", "write");
  const { admissionId, formKey } = await ctx.params;
  return ok(await saveForm(parseId(admissionId), formKey, await readJson(req), session, false));
});
