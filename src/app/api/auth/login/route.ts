import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { validate } from "@/server/lib/validation";
import { login, sessionUser } from "@/server/services/auth-service";
import { setSessionCookie } from "@/server/auth/server";

const schema = {
  email: { type: "string", required: true, max: 160 },
  password: { type: "string", required: true, min: 1, max: 100 },
} as const;

export const POST = withRoute(async (req: NextRequest) => {
  const body = await readJson(req);
  const { email, password } = validate(schema, body);
  const session = await login(email, password);
  const res = ok(sessionUser(session));
  await setSessionCookie(res, session);
  return res;
});
