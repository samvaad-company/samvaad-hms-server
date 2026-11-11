import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { addVaccination, listVaccinations } from "@/services/patient-vaccinations-service";

type Ctx = { params: Promise<{ id: string }> };

/** The patient's vaccinations. */
export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await listVaccinations(parseId((await ctx.params).id), await requirePermission("patients", "read"))));

/** { vaccine, dose?, givenOn?, dateUnknown?, approxWhen?, nextDue?, note? } — a date, or dateUnknown: true. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => created(await addVaccination(parseId((await ctx.params).id), await readJson(req), await requirePermission("patients", "add"))));
