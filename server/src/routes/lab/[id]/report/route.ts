import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import {
  uploadLabReport,
  getLabReportFile,
} from "@/services/lab-service";

/** Upload a report document (PDF/image as data URL) for a test. */
export const POST = actionRoute("lab", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await uploadLabReport(parseId(id), body, session));
});

/** Fetch the uploaded report document for viewing / downloading. */
export const GET = actionRoute("lab", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getLabReportFile(parseId(id), session));
});
