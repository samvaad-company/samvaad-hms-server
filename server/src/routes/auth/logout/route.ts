import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { clearSessionCookie } from "@/auth/server";

export const POST = withRoute(async () => {
  const res = ok({ ok: true });
  clearSessionCookie(res);
  return res;
});
