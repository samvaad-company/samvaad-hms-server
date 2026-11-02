import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { getMine } from "@/services/training-service";

/** My progress through the lessons, and the ones recommended to my role. */
export const GET = withRoute(async () => ok(await getMine(await requireSession())));
