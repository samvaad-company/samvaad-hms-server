/** The caller's notifications (newest first, with the unread count); POST { ids } or { all: true } marks them read. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { markRead, myNotifications } from "@/services/notifications-service";

export const GET = withRoute(async () => ok(await myNotifications(await requireSession())));
export const POST = withRoute(async (req: ApiRequest) => ok(await markRead(await readJson(req), await requireSession())));
