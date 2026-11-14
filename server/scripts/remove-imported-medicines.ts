/** Removes the medicines added by import-medicines.ts (the ones with a product id), leaving each hospital's own list as it was. */
import fs from "node:fs";
import { MongoClient } from "mongodb";

for (const line of fs.readFileSync(new URL("../.env", import.meta.url), "utf8").split(/\r?\n/)) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const client = await new MongoClient(process.env.MONGODB_URI!).connect();
try {
  const db = client.db(process.env.MONGODB_DB);
  const meds = db.collection("medicines");
  console.log("with product id before:", await meds.countDocuments({ product_id: { $exists: true, $ne: null } }));
  let removed = 0;
  for (;;) {
    const ids = (await meds.find({ product_id: { $exists: true, $ne: null } }, { projection: { _id: 1 } }).limit(20000).toArray()).map((d) => d._id);
    if (ids.length === 0) break;
    removed += (await meds.deleteMany({ _id: { $in: ids } })).deletedCount;
    process.stdout.write(`\rremoved ${removed}`);
  }
  console.log(`\nremoved ${removed}; medicines left: ${await meds.countDocuments({})}`);
  const st = await db.stats();
  console.log(`data ${(st.dataSize / 1048576).toFixed(0)} MB, storage ${(st.storageSize / 1048576).toFixed(0)} MB, indexes ${(st.indexSize / 1048576).toFixed(0)} MB`);
} finally { await client.close(); }
