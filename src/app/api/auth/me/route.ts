import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { sessionUser } from "@/server/services/auth-service";

/** Returns the current authenticated user + their permission matrix. */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(sessionUser(session));
});
