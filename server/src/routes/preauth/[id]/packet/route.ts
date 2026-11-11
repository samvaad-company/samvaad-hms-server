/** The papers that can go into this form's one-PDF packet (GET), and the chosen ones' contents (POST). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { parseId } from "@/http/crud";
import { requireSession } from "@/auth/server";
import { getPacketContent, getPacketOptions } from "@/services/preauth-packet-service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withRoute(async (_req: ApiRequest, ctx: Ctx) => ok(await getPacketOptions(parseId((await ctx.params).id), await requireSession())));

/** { prescriptions: [id], reports: ["report:lab:12"], documents: [id] } */
export const POST = withRoute(async (req: ApiRequest, ctx: Ctx) => ok(await getPacketContent(parseId((await ctx.params).id), await readJson(req), await requireSession())));
