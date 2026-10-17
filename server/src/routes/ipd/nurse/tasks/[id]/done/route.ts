import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { setTaskDone } from "@/services/nurse-station-service";

type Ctx = { params: Promise<{ id: string }> };

/** { undo?: true } puts a finished task back on the list. */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => {
  const session = await requirePermission("nursing", "write");
  const body = await readJson(req).catch(() => ({}));
  return ok(await setTaskDone(parseId((await ctx.params).id), body, session));
});
