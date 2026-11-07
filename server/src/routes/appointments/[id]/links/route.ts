/**
 * Sets or clears an appointment's loyalty links: `{ referredByPatientId?, familyOfPatientId?, familyRelation? }`, each optional and
 * null to clear. Receptionists (who can edit appointments) and doctors (who otherwise can't) may do this, and nothing else here.
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { can } from "@/auth/rbac";
import { ForbiddenError } from "@/lib/errors";
import { setAppointmentLinks } from "@/services/appointments-service";

type Ctx = { params: Promise<{ id: string }> };

const update = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requireSession();
  if (!can(session.role, "appointments", "write") && session.role !== "Doctor") throw new ForbiddenError(`Your role (${session.role}) cannot change who referred a patient or whose family they are.`);
  const { id } = await ctx.params;
  return ok(await setAppointmentLinks(parseId(id), await readJson(req), session));
});
export const PUT = update;
export const PATCH = update;
