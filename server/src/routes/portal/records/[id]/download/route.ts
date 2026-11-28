import { ApiResponse, type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { requirePortalKey, portalPatientId } from "@/auth/portal";
import { portalRecordFile } from "@/services/portal-records-service";

/**
 * Patient app: the file of one record (lab-31, radiology-4, doc-12). ?patientId=…[&inline=1]
 * Streamed through the HMS, never as a link; 404 when it is not this patient's. Every download is audited.
 */
export const GET = withRoute(async (req: ApiRequest, ctx: { params: Promise<{ id: string }> }) => {
  requirePortalKey(req);
  const q = new URL(req.url, "http://localhost").searchParams;
  const file = await portalRecordFile((await ctx.params).id, portalPatientId(q.get("patientId")));
  const safe = file.fileName.replace(/[^\w.\- ]+/g, "_");
  return new ApiResponse(new Uint8Array(file.data), {
    status: 200,
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.data.length),
      "Content-Disposition": `${q.get("inline") === "1" ? "inline" : "attachment"}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
