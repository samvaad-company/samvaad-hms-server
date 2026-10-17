import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getBoard } from "@/services/nurse-station-service";

/** Live state of every admitted patient (doses, IV, rounds, vitals) for the admissions list. */
export const GET = withRoute(async () => ok(await getBoard(await requirePermission("ipd", "read"))));
