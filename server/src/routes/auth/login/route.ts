import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { validate } from "@/lib/validation";
import { login, sessionUser } from "@/services/auth-service";
import { setSessionCookie } from "@/auth/server";

const schema = {
  email: { type: "string", required: true, max: 160 },
  password: { type: "string", required: true, min: 1, max: 100 },
} as const;

export const POST = withRoute(async (req: ApiRequest) => {
  const body = await readJson(req);
  const { email, password } = validate(schema, body);
  const session = await login(email, password);
  const res = ok(sessionUser(session));
  await setSessionCookie(res, session);
  return res;
});
