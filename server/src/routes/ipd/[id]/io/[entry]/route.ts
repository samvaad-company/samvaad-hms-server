import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";

import { deleteIo } from "@/services/ipd-chart-service";

type EntryCtx = { params: Promise<{ id: string; entry: string }> };

export const DELETE = withRoute(async (_req: ApiRequest, ctx: EntryCtx) => {
  const { id, entry } = await ctx.params;
  await deleteIo(parseId(id), parseId(entry), await requirePermission("nursing", "write"));
  return ok({ deleted: true });
});
