import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { parseListParams } from "@/server/http/query";
import { paginated, makePaginationMeta } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import {
  listAttendance,
  ATTENDANCE_LIST_CONFIG,
} from "@/server/services/attendance-service";

export const GET = withRoute(async (req: NextRequest) => {
  await requirePermission("staff", "read");
  const options = parseListParams(req, ATTENDANCE_LIST_CONFIG);
  const { rows, total } = await listAttendance(options);
  return paginated(
    rows,
    makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
  );
});
