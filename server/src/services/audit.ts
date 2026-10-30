/**
 * Audit logging service. Records who changed what, for traceability.
 * Failures here never block the primary operation.
 *
 * Each hospital's entries form a hash chain: an entry carries the hash of the one before it, so an entry that is edited or
 * removed afterwards breaks the chain from that point on (Reports → Audit → "Verify chain" walks it).
 */
import { createHash } from "node:crypto";
import { auditRepo } from "@/repositories";
import { logger } from "@/lib/logger";
import { withKeyLocks } from "@/lib/key-lock";
import { type Session } from "@/auth/session";

export const GENESIS_HASH = "0".repeat(64);

export interface ChainLink { prev: string; hash: string }

/** What an entry's hash covers: the link before it and what was recorded — never the link itself. */
export function chainHash(prev: string, e: { actor_id: number | null; actor_name: string; action: string; entity: string; entity_id: string; meta: Record<string, unknown> }): string {
  const { _chain: _ignored, ...meta } = e.meta;
  void _ignored;
  return createHash("sha256").update(JSON.stringify([prev, e.actor_id, e.actor_name, e.action, e.entity, e.entity_id, meta])).digest("hex");
}

export async function audit(
  actor: Session | null,
  action: string,
  entity: string,
  entityId: string | number,
  meta: Record<string, unknown> = {},
): Promise<void> {
  try {
    const hospitalId = actor?.hospitalId ?? null;
    const entry = { actor_id: actor?.userId ?? null, actor_name: actor?.name ?? "system", action, entity, entity_id: String(entityId), meta };
    // One writer at a time per hospital, so two entries can never claim the same predecessor.
    await withKeyLocks([`audit-chain:${hospitalId ?? 0}`], async () => {
      const last = hospitalId != null
        ? (await auditRepo.listRows({ filters: [{ column: "hospital_id", op: "eq", value: hospitalId }], sort: [{ column: "id", direction: "desc" }], page: 1, pageSize: 1 })).rows[0]
        : undefined;
      const prev = (last?.meta as { _chain?: ChainLink } | null)?._chain?.hash ?? GENESIS_HASH;
      const link: ChainLink = { prev, hash: chainHash(prev, entry) };
      await auditRepo.create({ ...(hospitalId != null ? { hospital_id: hospitalId } : {}), ...entry, meta: { ...meta, _chain: link } });
    });
  } catch (err) {
    logger.warn("audit.failed", {
      action,
      entity,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
