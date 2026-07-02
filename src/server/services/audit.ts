/**
 * Audit logging service. Records who changed what, for traceability.
 * Failures here never block the primary operation.
 */
import { auditRepo } from "@/server/repositories";
import { logger } from "@/server/lib/logger";
import { type Session } from "@/server/auth/session";

export async function audit(
  actor: Session | null,
  action: string,
  entity: string,
  entityId: string | number,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    await auditRepo.create({
      actor_id: actor?.userId ?? null,
      actor_name: actor?.name ?? "system",
      action,
      entity,
      entity_id: String(entityId),
      meta,
    });
  } catch (err) {
    logger.warn("audit.failed", {
      action,
      entity,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
