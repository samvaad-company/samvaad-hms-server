import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { created, paginated, makePaginationMeta } from "@/http/response";
import { requirePermission } from "@/auth/server";
import {
  listPrescriptionTemplates,
  createPrescriptionTemplate,
} from "@/services/prescription-templates-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("prescriptions", "read");
  const { rows, total } = await listPrescriptionTemplates(session);
  return paginated(rows, makePaginationMeta(1, rows.length, total));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "write");
  const body = await readJson(req);
  const result = await createPrescriptionTemplate(body, session);
  return created(result);
});
