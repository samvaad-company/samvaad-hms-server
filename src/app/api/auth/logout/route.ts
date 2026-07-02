import { withRoute } from "@/server/http/handler";
import { ok } from "@/server/http/response";
import { clearSessionCookie } from "@/server/auth/server";

export const POST = withRoute(async () => {
  const res = ok({ ok: true });
  clearSessionCookie(res);
  return res;
});
