/** One admission's whole case file: every form (saved or still blank) and what the rest of the app holds about the patient. */
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requirePermission } from "@/auth/server";
import { getCaseFile } from "@/services/casefile-service";

type Ctx = { params: Promise<{ admissionId: string }> };

export const GET = withRoute(async (_req, ctx: Ctx) => {
  const session = await requirePermission("casefile", "read");
  const { admissionId } = await ctx.params;
  return ok(await getCaseFile(parseId(admissionId), session));
});
