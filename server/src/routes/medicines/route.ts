import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { parseListParams } from "@/http/query";
import { paginated, makePaginationMeta } from "@/http/response";
import { requireSession } from "@/auth/server";
import { listMedicines, MEDICINE_LIST_CONFIG } from "@/services/admin-service";

/** Medicine catalog — readable by any authenticated user (used by Rx builder). */
export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requireSession();
  const options = parseListParams(req, MEDICINE_LIST_CONFIG);
  const { rows, total } = await listMedicines(options, session);
  return paginated(
    rows,
    makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
  );
});
