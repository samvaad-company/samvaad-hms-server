import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listTemplates, createTemplate } from "@/services/consent-templates-service";

/** Every form a consent can be made from: the built-in ones, then the hospital's own. */
export const GET = withRoute(async () => ok(await listTemplates(await requirePermission("consents", "read"))));

/** { titles: {English, Hindi?, Gujarati?}, bodies: {…}, active? } */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("consents", "write");
  return created(await createTemplate(await readJson(req), session));
});
