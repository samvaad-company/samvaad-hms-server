import { type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { readJson } from "@/server/http/query";
import { created, paginated, makePaginationMeta } from "@/server/http/response";
import { requirePermission } from "@/server/auth/server";
import {
  listPrescriptionTemplates,
  createPrescriptionTemplate,
} from "@/server/services/prescription-templates-service";

export const GET = withRoute(async () => {
  const session = await requirePermission("prescriptions", "read");
  const { rows, total } = await listPrescriptionTemplates(session);
  return paginated(rows, makePaginationMeta(1, rows.length, total));
});

export const POST = withRoute(async (req: NextRequest) => {
  const session = await requirePermission("prescriptions", "write");
  const body = await readJson(req);
  const result = await createPrescriptionTemplate(body, session);
  return created(result);
});
