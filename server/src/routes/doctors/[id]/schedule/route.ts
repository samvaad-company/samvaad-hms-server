import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { getDoctorSchedule, updateDoctorSchedule } from "@/services/doctor-schedule-service";

/** A doctor's scheduling settings: patients per hour, whether they take video consultations, and their video hours. */
export const GET = withRoute(async (_req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  return ok(await getDoctorSchedule(parseId(id), session));
});

/** Change them — the doctor themselves, or an administrator. */
export const PUT = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  return ok(await updateDoctorSchedule(parseId(id), body, session));
});
