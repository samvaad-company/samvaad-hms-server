import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { readJson } from "@/http/query";
import { requireSession } from "@/auth/server";
import { record } from "@/services/training-service";

/** { lessonId, event: "start" | "step" | "complete" | "skip", step? } */
export const POST = withRoute(async (req) => ok(await record(await readJson(req), await requireSession())));
