import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import { requireSession, setSessionCookie } from "@/auth/server";
import { getMyProfile, updateMyProfile } from "@/services/profile-service";
import { sessionUser } from "@/services/auth-service";

/** The signed-in user's own details (any role). */
export const GET = withRoute(async () => ok(await getMyProfile(await requireSession())));

export const PATCH = withRoute(async (req: ApiRequest) => {
  const actor = await requireSession();
  const session = await updateMyProfile(await readJson(req), actor);
  const res = ok({ profile: await getMyProfile(session), user: sessionUser(session) });
  await setSessionCookie(res, session);
  return res;
});
export const PUT = PATCH;
