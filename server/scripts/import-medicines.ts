/**
 * Loads the drug directory (from xlsx-to-jsonl.py) into the `medicines` collection as ONE shared catalogue for every hospital
 * (hospital_id 0). A copy per hospital would not fit the free 512 MB MongoDB plan.
 *
 *   npx tsx scripts/import-medicines.ts <drugs.jsonl>            dry run: counts only, writes nothing
 *   npx tsx scripts/import-medicines.ts <drugs.jsonl> --apply    writes
 *
 * Safe to run again: a medicine already in the shared catalogue (same product id) is skipped; existing rows are never changed.
 */
import fs from "node:fs";
import readline from "node:readline";
import { MongoClient } from "mongodb";

const [file, ...flags] = process.argv.slice(2);
const apply = flags.includes("--apply");
if (!file) { console.error("usage: import-medicines.ts <drugs.jsonl> [--apply]"); process.exit(1); }

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const uri = process.env.MONGODB_URI, dbName = process.env.MONGODB_DB;
if (!uri || !dbName) { console.error("MONGODB_URI / MONGODB_DB are not set"); process.exit(1); }

interface Drug { productId: string; name: string; marketer?: string; composition?: string; packaging?: string; package?: string; form?: string; mrp?: string }

async function main() {
  const drugs: Drug[] = [];
  for await (const line of readline.createInterface({ input: fs.createReadStream(file, "utf8") })) if (line.trim()) drugs.push(JSON.parse(line));
  console.log(`${drugs.length} medicines in ${file}`);

  const client = await new MongoClient(uri!).connect();
  try {
    const db = client.db(dbName);
    const meds = db.collection("medicines");
    const counters = db.collection("counters");

    const existing = await meds.find({ hospital_id: 0 }, { projection: { product_id: 1 } }).toArray();
    const have = new Set(existing.map((e) => e.product_id));
    const fresh = drugs.filter((d) => !have.has(d.productId));
    console.log(`shared catalogue: has ${existing.length}, would add ${fresh.length}`);

    if (apply && fresh.length > 0) {
      // Reserve a block of ids in one step, then insert in batches.
      const after = await counters.findOneAndUpdate({ _id: "medicines" as never }, { $inc: { seq: fresh.length } }, { upsert: true, returnDocument: "after" });
      const first = ((after?.seq as number) ?? fresh.length) - fresh.length + 1;
      const now = new Date().toISOString();
      let done = 0;
      for (let i = 0; i < fresh.length; i += 5000) {
        const docs = fresh.slice(i, i + 5000).map((d, k) => ({
          id: first + i + k, hospital_id: 0, name: d.name.slice(0, 160), generic: (d.composition ?? "").slice(0, 300), category: d.form || "Drugs",
          default_dosage: "", default_frequency: "", default_duration: "", unit: d.package || "Unit",
          product_id: d.productId, manufacturer: d.marketer ?? "", pack: d.packaging ?? "", mrp: Number(d.mrp) || null, price: null,
          created_at: now, updated_at: now,
        }));
        await meds.insertMany(docs, { ordered: false });
        done += docs.length;
        console.log(`  ${done}/${fresh.length}`);
        const st = await db.stats();
        if ((st.storageSize + st.indexSize) / 1048576 > 440) { console.error("Stopping: the database is nearly at its 512 MB limit."); break; }
      }
      const st = await db.stats();
      console.log(`storage now ${(st.storageSize / 1048576).toFixed(0)} MB + indexes ${(st.indexSize / 1048576).toFixed(0)} MB of 512 MB`);
    }
    console.log(apply ? "Done." : "Dry run only — nothing was written. Add --apply to import.");
  } finally {
    await client.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
