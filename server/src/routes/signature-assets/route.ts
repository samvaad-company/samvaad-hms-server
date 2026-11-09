/** The caller's own signature / stamp images: GET them, PUT { kind, image } to keep one, DELETE ?kind= to remove one. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { myAssets, removeAsset, setAsset } from "@/services/signature-assets-service";

export const GET = withRoute(async () => ok(await myAssets(await requireSession())));
export const PUT = withRoute(async (req: ApiRequest) => ok(await setAsset(await readJson(req), await requireSession())));
export const DELETE = withRoute(async (req: ApiRequest) => ok(await removeAsset(new URL(req.url, "http://localhost").searchParams.get("kind"), await requireSession())));
