import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listDispenses, createDispense } from "@/services/dispense-service";

/** Recent dispensing, newest first (?limit=, up to 100). */
export const GET = withRoute(async (req) => {
  const session = await requirePermission("pharmacy", "read");
  const limit = Number(new URL(req.url).searchParams.get("limit"));
  return ok(await listDispenses(Number.isFinite(limit) && limit > 0 ? limit : 30, session));
});

/** { patientId?, walkInNote?, prescriptionId?, billing: "none" | "separate" | "patient", lines: [{ itemId, quantity, unitPrice? }] } */
export const POST = withRoute(async (req) => {
  const session = await requirePermission("pharmacy", "write");
  return created(await createDispense(await readJson(req), session));
});
