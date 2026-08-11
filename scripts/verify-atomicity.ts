/**
 * Proves the unit of work rolls back partial writes.
 *
 * Runs a multi-table operation that fails on the last step and asserts that
 * nothing it wrote survives. Run with: npx tsx scripts/verify-atomicity.ts
 */
import { getDb } from "@/server/db";
import { TABLES } from "@/server/db/tables";
import { transactional } from "@/server/db/unit-of-work";

async function main() {
  const db = await getDb();

  const countOf = async (table: string) => (await db.list(table, { unpaged: true })).total;
  const stockOf = async (id: number) =>
    Number(
      (await db.findById<{ id: number; stock: number }>(TABLES.pharmacyItems, id))?.stock ?? -1,
    );

  const salesBefore = await countOf(TABLES.pharmacySales);
  const itemsBefore = await countOf(TABLES.pharmacySaleItems);
  const billsBefore = await countOf(TABLES.bills);
  const stockBefore = await stockOf(1);

  console.log("before:", { salesBefore, itemsBefore, billsBefore, stockBefore });

  let threw = false;
  try {
    await transactional("verify.partialFailure", async (uow) => {
      const sale = await uow.insert<{ id: number } & Record<string, unknown>>(TABLES.pharmacySales, {
        sale_number: "SALE-VERIFY", patient_id: null, patient_name: "Rollback Test",
        prescription_id: null, rx_number: "", item_count: 1, subtotal: 100,
        discount: 0, total: 100, payment_mode: "Cash", sale_date: "2026-01-01", bill_id: null,
      });
      await uow.insert(TABLES.pharmacySaleItems, {
        sale_id: sale.id, pharmacy_item_id: 1, medicine_name: "Rollback Test",
        quantity: 5, unit_price: 20, line_total: 100,
      });
      await uow.update(TABLES.pharmacyItems, 1, { stock: stockBefore - 5 });
      await uow.insert(TABLES.bills, {
        bill_number: "INV-VERIFY", patient_id: null, patient_name: "Rollback Test",
        type: "Pharmacy", bill_date: "2026-01-01", amount: 100, discount: 0,
        gst: 0, total: 100, status: "Paid",
      });
      // Simulates any late failure: a validation error, a dropped connection, …
      throw new Error("simulated failure after all writes");
    });
  } catch {
    threw = true;
  }

  const salesAfter = await countOf(TABLES.pharmacySales);
  const itemsAfter = await countOf(TABLES.pharmacySaleItems);
  const billsAfter = await countOf(TABLES.bills);
  const stockAfter = await stockOf(1);

  console.log("after :", { salesAfter, itemsAfter, billsAfter, stockAfter });

  const checks = [
    ["operation threw", threw],
    ["no orphan sale", salesAfter === salesBefore],
    ["no orphan sale items", itemsAfter === itemsBefore],
    ["no orphan bill", billsAfter === billsBefore],
    ["stock restored", stockAfter === stockBefore],
  ] as const;

  let ok = true;
  for (const [name, pass] of checks) {
    console.log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
    if (!pass) ok = false;
  }
  console.log(ok ? "\nATOMICITY VERIFIED" : "\nATOMICITY FAILED");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
