/** Remarks a doctor keeps for later, and advice kept for a patient. */
import { type ApiRequest } from "@/http/web";
import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listSavedNotes, addSavedNote } from "@/services/saved-notes-service";

const posInt = (v: string | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

export const GET = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "read");
  const sp = new URL(req.url, "http://localhost").searchParams;
  return ok(await listSavedNotes(session, {
    kind: sp.get("kind") ?? "remark", doctorId: posInt(sp.get("doctorId")), patientId: posInt(sp.get("patientId")),
    q: sp.get("q") ?? "", limit: Math.min(100, Number(sp.get("limit")) || 30),
  }));
});

export const POST = withRoute(async (req: ApiRequest) => {
  const session = await requirePermission("prescriptions", "write");
  return created(await addSavedNote(await readJson(req), session));
});
