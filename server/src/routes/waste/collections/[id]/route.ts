import { ok } from "@/http/response";
import { actionRoute, parseId } from "@/http/crud";
import { deleteCollection } from "@/services/waste-ic-service";

export const DELETE = actionRoute("cssd", "write", async (_req, ctx, session) => { await deleteCollection(parseId((await ctx.params).id), session); return ok({ deleted: true }); });
