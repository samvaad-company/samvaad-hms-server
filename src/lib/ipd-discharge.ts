import { api, ApiClientError } from "@/lib/api/client";

/**
 * Discharge an admission. When unpaid IPD bills stand in the way the server refuses (409); someone who can write billing
 * is asked for a reason and the discharge goes through with the bills waived on the record. Anyone else sees the message
 * ("settle them first"), so the error is rethrown for the caller to show.
 */
export async function dischargeAdmission(id: number | string): Promise<void> {
  try {
    await api.post(`/ipd/${id}/discharge`);
  } catch (err) {
    const d = err instanceof ApiClientError && err.status === 409 ? (err.details as { unpaid?: number; canWaive?: boolean } | undefined) : undefined;
    if (!d?.unpaid || !d.canWaive) throw err;
    const reason = window.prompt(`${(err as ApiClientError).message}\n\nTo discharge anyway, type why the unpaid bills are being waived (Cancel to settle them first):`);
    if (!reason?.trim()) throw err;
    await api.post(`/ipd/${id}/discharge`, { waiveBilling: true, reason: reason.trim() });
  }
}
