import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { getPatientSummary } from "@/services/patients-service";

/** Patient headcounts (total and per status) for the list's filter chips. */
export const GET = withRoute(async () => ok(await getPatientSummary(await requirePermission("patients", "read"))));
