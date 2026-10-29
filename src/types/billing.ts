/**
 * How an invoice's totals are worked out. Shared by the server (which is the one that counts) and the New Bill screen (which
 * previews), so what the counter sees is what is saved.
 */
export interface PricedLine { quantity: number; unitPrice: number; gstRate: number }
export interface BillingSwitches { gstOnBills: boolean; pricesInclusive: boolean; roundOff: boolean }

export const r2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Lines → amount (before discount), GST and total. A discount is spread across the lines in proportion before tax. With
 * tax-inclusive prices the GST is already inside the prices, so it is shown but not added. Rounding (to the rupee) applies to the total.
 */
export function priceLines(lines: PricedLine[], discount: number, cfg: BillingSwitches): { amounts: number[]; totals: number[]; amount: number; gst: number; total: number } {
  const amounts = lines.map((l) => r2(l.quantity * l.unitPrice));
  const amount = r2(amounts.reduce((n, a) => n + a, 0));
  const lineGst = lines.map((l, i) => {
    if (!cfg.gstOnBills || l.gstRate <= 0 || amount <= 0) return 0;
    const taxable = amounts[i] - (discount * amounts[i]) / amount;
    return cfg.pricesInclusive ? taxable - taxable / (1 + l.gstRate / 100) : (taxable * l.gstRate) / 100;
  });
  const gst = r2(lineGst.reduce((n, g) => n + g, 0));
  // What each line comes to: its share of the discount taken off, with GST on top unless the price already had it.
  const totals = lines.map((_, i) => r2(amounts[i] - (amount > 0 ? (discount * amounts[i]) / amount : 0) + (cfg.pricesInclusive ? 0 : lineGst[i])));
  let total = cfg.pricesInclusive ? r2(amount - discount) : r2(amount - discount + gst);
  if (cfg.roundOff) total = Math.round(total);
  return { amounts, totals, amount, gst, total };
}
