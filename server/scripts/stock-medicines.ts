/**
 * Puts a starter set of directory medicines into every hospital's pharmacy inventory, 100 units each.
 *
 *   npx tsx scripts/stock-medicines.ts <drugs.jsonl> [count]            dry run: shows what would be added
 *   npx tsx scripts/stock-medicines.ts <drugs.jsonl> [count] --apply    writes
 *
 * The set is chosen for variety: one medicine per composition and form, from the marketers with the most products (the big
 * brands first). A medicine the pharmacy already holds (same name) is skipped. Batches are made by the app the first time an
 * item is dispensed, so only the inventory rows are written here.
 */
import fs from "node:fs";
import readline from "node:readline";
import { MongoClient } from "mongodb";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const apply = process.argv.includes("--apply");
const [file, countArg] = args;
const COUNT = Number(countArg ?? 10000);
const QTY = 100, MIN = 10;
if (!file) { console.error("usage: stock-medicines.ts <drugs.jsonl> [count] [--apply]"); process.exit(1); }

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

interface Drug { productId: string; name: string; marketer?: string; composition?: string; form?: string; mrp?: string }

const plusYears = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10); };

async function main() {
  const drugs: Drug[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(file, "utf8") })) if (line.trim()) drugs.push(JSON.parse(line));

  // Rank marketers by how many products they have, then take one product per composition + form, biggest marketers first.
  const size = new Map<string, number>();
  for (const d of drugs) size.set(d.marketer ?? "", (size.get(d.marketer ?? "") ?? 0) + 1);
  const ranked = [...drugs].filter((d) => Number(d.mrp) > 0 && d.name.length >= 2).sort((a, b) => (size.get(b.marketer ?? "") ?? 0) - (size.get(a.marketer ?? "") ?? 0) || a.name.localeCompare(b.name));
  const seen = new Set<string>();
  const chosen: Drug[] = [];
  for (const d of ranked) {
    const key = `${(d.composition ?? "").toLowerCase()}|${(d.form ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chosen.push(d);
    if (chosen.length >= COUNT) break;
  }
  console.log(`${chosen.length} medicines chosen (from ${drugs.length}); first: ${chosen.slice(0, 4).map((d) => d.name).join("; ")}`);

  const client = await new MongoClient(process.env.MONGODB_URI!).connect();
  try {
    const db = client.db(process.env.MONGODB_DB);
    const items = db.collection("pharmacy_items");
    const counters = db.collection("counters");
    const hospitals = await db.collection("hospitals").find({}, { projection: { id: 1, name: 1 } }).toArray();
    for (const h of hospitals) {
      const have = new Set((await items.find({ hospital_id: h.id }, { projection: { name: 1 } }).toArray()).map((i) => String(i.name).toLowerCase()));
      const fresh = chosen.filter((d) => !have.has(d.name.toLowerCase()));
      console.log(`#${h.id} ${h.name}: holds ${have.size}, would add ${fresh.length} at ${QTY} units each`);
      if (!apply || fresh.length === 0) continue;
      const after = await counters.findOneAndUpdate({ _id: "pharmacy_items" as never }, { $inc: { seq: fresh.length } }, { upsert: true, returnDocument: "after" });
      const first = ((after?.seq as number) ?? fresh.length) - fresh.length + 1;
      const now = new Date().toISOString();
      const expiry = plusYears(2);
      for (let i = 0; i < fresh.length; i += 2000) {
        await items.insertMany(fresh.slice(i, i + 2000).map((d, k) => ({
          id: first + i + k, hospital_id: h.id, name: d.name.slice(0, 160), category: (d.form || "General").slice(0, 80), stock: QTY, min_stock: MIN,
          expiry_date: expiry, supplier: (d.marketer ?? "").slice(0, 160), status: "In Stock", unit_price: Number(d.mrp) || null, created_at: now, updated_at: now,
        })), { ordered: false });
      }
      const st = await db.command({ dbStats: 1 });
      console.log(`  added. database now ${((st.storageSize + st.indexSize) / 1048576).toFixed(0)} MB of 512 MB`);
    }
    console.log(apply ? "Done." : "Dry run only — nothing was written. Add --apply to stock them.");
  } finally { await client.close(); }
}
main().catch((e) => { console.error(e); process.exit(1); });
