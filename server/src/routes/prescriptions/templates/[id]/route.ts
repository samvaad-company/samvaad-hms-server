import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, noContent } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import {
  updatePrescriptionTemplate,
  deletePrescriptionTemplate,
} from "@/services/prescription-templates-service";

type Ctx = { params: Promise<{ id: string }> };

const update = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updatePrescriptionTemplate(parseId(id), body, session));
});

export const PUT = update;
export const PATCH = update;

export const DELETE = withRoute(async (_req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  const { id } = await ctx.params;
  await deletePrescriptionTemplate(parseId(id), session);
  return noContent();
});
