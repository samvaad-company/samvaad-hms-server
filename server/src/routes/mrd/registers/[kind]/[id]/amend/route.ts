import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { amendEntry } from "@/services/mrd-registers-service";

type Ctx = { params: Promise<{ kind: string; id: string }> };

/** Files a corrected entry that supersedes this one (needs `amendmentReason`). */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("mrd", "write");
  const { kind, id } = await ctx.params;
  return created(await amendEntry(kind, parseId(id), await readJson(req), session));
});
