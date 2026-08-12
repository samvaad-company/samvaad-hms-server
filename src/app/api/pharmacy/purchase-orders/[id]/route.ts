import { itemRoute } from "@/server/http/crud";
import {
  getPurchaseOrder,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  deletePurchaseOrder,
} from "@/server/services/pharmacy-orders-service";
import { type Session } from "@/server/auth/session";

/** A status-only patch (e.g. "Receive stock") vs. a full content edit take different paths. */
function update(id: number, input: unknown, actor: Session) {
  const body = (input ?? {}) as Record<string, unknown>;
  if ("supplier" in body || "expectedDate" in body || "items" in body) {
    return updatePurchaseOrder(id, input, actor);
  }
  return updatePurchaseOrderStatus(id, String(body.status ?? ""), actor);
}

export const { GET, PUT, PATCH, DELETE } = itemRoute({
  resource: "pharmacy",
  get: getPurchaseOrder,
  update,
  remove: deletePurchaseOrder,
});
