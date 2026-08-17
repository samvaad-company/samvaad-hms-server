import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { parseListParams } from "@/server/http/query";
import { paginated, makePaginationMeta } from "@/server/http/response";
import { requireSession } from "@/server/auth/server";
import { listMedicines, MEDICINE_LIST_CONFIG } from "@/server/services/admin-service";

/** Medicine catalog — readable by any authenticated user (used by Rx builder). */
export const GET = withRoute(async (req: NextRequest) => {
  const session = await requireSession();
  const options = parseListParams(req, MEDICINE_LIST_CONFIG);
  const { rows, total } = await listMedicines(options, session);
  return paginated(
    rows,
    makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
  );
});
