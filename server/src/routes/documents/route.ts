/**
 * Documents collection: list metadata (GET) and upload a file (POST,
 * multipart/form-data with fields: file, ownerType, ownerId, category).
 */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { parseListParams } from "@/http/query";
import { ok, created, paginated, makePaginationMeta } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import {
  listDocuments,
  uploadDocument,
  DOCUMENTS_LIST_CONFIG,
} from "@/services/documents-service";

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("documents", "read");
  const options = parseListParams(req, DOCUMENTS_LIST_CONFIG);
  const { rows, total } = await listDocuments(options, session);
  return paginated(
    rows,
    makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
  );
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("documents", "write");
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new BadRequestError("Missing file");

  const result = await uploadDocument(
    {
      file,
      ownerType: String(form.get("ownerType") ?? ""),
      ownerId: Number(form.get("ownerId")),
      category: (form.get("category") as string) ?? undefined,
    },
    session,
  );
  return created(result);
});
