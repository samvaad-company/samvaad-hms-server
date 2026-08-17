/** Streams the stored file back with its original name and content type. */
import { NextResponse, type NextRequest } from "next/server";
import { withRoute } from "@/server/http/handler";
import { requirePermission } from "@/server/auth/server";
import { parseId } from "@/server/http/crud";
import { readDocument } from "@/server/services/documents-service";

export const GET = withRoute(async (
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => {
  const session = await requirePermission("documents", "read");
  const { id } = await ctx.params;
  const { row, data } = await readDocument(parseId(id), session);

  return new NextResponse(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.size_bytes),
      "Content-Disposition": `inline; filename="${encodeURIComponent(row.file_name)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
});
