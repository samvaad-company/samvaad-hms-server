import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { reset } from "@/services/training-service";

/** Forget my progress so every lesson is new again. */
export const POST = withRoute(async () => ok(await reset(await requireSession())));
