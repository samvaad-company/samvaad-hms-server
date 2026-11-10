/** A doctor turns automatic signing on or off: PUT { enabled: boolean }. Returns the caller's assets (with autoSign). */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { setAutoSign } from "@/services/signature-assets-service";

export const PUT = withRoute(async (req: ApiRequest) => ok(await setAutoSign(await readJson(req), await requireSession())));
