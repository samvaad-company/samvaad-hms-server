/** Streams the stored file back with its original name and content type. */
import { ApiResponse, type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { requirePermission } from "@/auth/server";
import { parseId } from "@/http/crud";
import { readDocument } from "@/services/documents-service";

export const GET = withRoute(async (
  _req: ApiRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  const session = await requirePermission("documents", "read");
  const { id } = await ctx.params;
  const { row, data } = await readDocument(parseId(id), session);

  return new ApiResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.size_bytes),
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.file_name)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
