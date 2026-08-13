import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok, noContent } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import {
  updatePrescriptionTemplate,
  deletePrescriptionTemplate,
} from "@/server/services/prescription-templates-service";

type Ctx = { params: Promise<{ id: string }> };

const update = withRoute(async (req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await updatePrescriptionTemplate(parseId(id), body, session));
});

export const PUT = update;
export const PATCH = update;

export const DELETE = withRoute(async (_req: NextRequest, ctx: Ctx) => {
  const session = await requirePermission("prescriptions", "write");
  const { id } = await ctx.params;
  await deletePrescriptionTemplate(parseId(id), session);
  return noContent();
});
