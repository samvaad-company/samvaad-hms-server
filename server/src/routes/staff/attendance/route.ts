import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { parseListParams } from "@/http/query";
import { paginated, makePaginationMeta } from "@/http/response";
import { requirePermission } from "@/auth/server";
import {
  listAttendance,
  ATTENDANCE_LIST_CONFIG,
} from "@/services/attendance-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("staff", "read");
  const options = parseListParams(req, ATTENDANCE_LIST_CONFIG);
  const { rows, total } = await listAttendance(options, session);
  return paginated(
    rows,
    makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
  );
});
