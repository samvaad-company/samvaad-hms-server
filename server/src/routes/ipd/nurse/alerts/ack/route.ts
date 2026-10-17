import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { ackAlerts } from "@/services/nurse-station-service";

/** { keys: string[], action?: "Acknowledged" | "Dismissed" } */
export const POST = withRoute(async (req: ApiRequest) => ok(await ackAlerts(await readJson(req), await requirePermission("nursing", "write"))));
