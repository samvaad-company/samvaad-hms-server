/** Records a punch in or punch out for a staff member. */
import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { ok } from "@/server/http/response";
import { BadRequestError } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/server";
import { punchIn, punchOut } from "@/server/services/attendance-service";

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("staff", "write");
  const body = (await readJson(req)) as { staffId?: number; action?: string };
  const staffId = Number(body?.staffId);
  if (!Number.isInteger(staffId) || staffId <= 0) {
    throw new BadRequestError("A valid staffId is required");
  }
  if (body?.action !== "in" && body?.action !== "out") {
    throw new BadRequestError('action must be "in" or "out"');
  }
  return ok(
    body.action === "in"
      ? await punchIn(staffId, session)
      : await punchOut(staffId, session),
  );
});
