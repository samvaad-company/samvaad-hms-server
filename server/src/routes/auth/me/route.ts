import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requireSession } from "@/auth/server";
import { sessionUser } from "@/services/auth-service";

/** Returns the current authenticated user + their permission matrix. */
export const GET = withRoute(async () => {
  const session = await requireSession();
  return ok(sessionUser(session));
});
