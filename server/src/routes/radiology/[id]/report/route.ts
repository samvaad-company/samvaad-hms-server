import { actionRoute, parseId } from "@/http/crud";
import { readJson } from "@/http/query";
import { ok } from "@/http/response";
import {
  uploadRadiologyReport,
  getRadiologyReportFile,
} from "@/services/radiology-service";

/** Upload a report document (PDF/image as data URL) for a study. */
export const POST = actionRoute("radiology", "write", async (req, ctx, session) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  return ok(await uploadRadiologyReport(parseId(id), body, session));
});

/** Fetch the uploaded report document for viewing / downloading. */
export const GET = actionRoute("radiology", "read", async (_req, ctx, session) => {
  const { id } = await ctx.params;
  return ok(await getRadiologyReportFile(parseId(id), session));
});
