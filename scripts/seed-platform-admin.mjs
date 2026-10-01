/**
 * One-off: insert the Platform Admin login into an already-populated Mongo
 * database. Needed because the app's normal auto-seed only fires on an
 * *empty* database (see seedIfEmpty in src/server/db/seed-runner.ts) — a
 * database that already has hospital 1 in it, like most deployed instances,
 * will never get the Platform Admin account from a redeploy alone.
 *
 * Idempotent: if a user with the target email already exists, this does
 * nothing and exits cleanly. Safe to re-run.
 *
 * Usage (reads your production connection string from the environment —
 * never hardcode it here or paste it into chat):
 *
 *   MONGODB_URI="<prod connection string>" node scripts/seed-platform-admin.mjs
 *
 * Optional overrides:
 *   MONGODB_DB               defaults to "samvaad_hms"
 *   PLATFORM_ADMIN_EMAIL     defaults to "platform-admin@samvaad.dev"
 *   PLATFORM_ADMIN_NAME      defaults to "Platform Operations"
 *   PLATFORM_ADMIN_PASSWORD  if unset, a random password is generated and
 *                            printed ONCE — save it, there is no other way
 *                            to retrieve it afterward. Rotate it after your
 *                            first login if you'd rather choose your own.
 */
import { MongoClient } from "mongodb";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function generatePassword() {
  return randomBytes(15).toString("base64url"); // 20 chars, URL-safe
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is required. See the usage comment at the top of this script.");
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || "samvaad_hms";
  const email = (process.env.PLATFORM_ADMIN_EMAIL || "platform-admin@samvaad.dev").toLowerCase();
  const name = process.env.PLATFORM_ADMIN_NAME || "Platform Operations";
  const providedPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  const password = providedPassword || generatePassword();

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  try {
    const users = db.collection("users");
    const existing = await users.findOne({ email });
    if (existing) {
      console.log(`A user with email "${email}" already exists (id ${existing.id}, role "${existing.role}"). Nothing changed.`);
      return;
    }

    // Same atomic counter the app's MongoAdapter uses for every insert, so
    // this id can never collide with one the app generates later.
    const counterRes = await db.collection("counters").findOneAndUpdate(
      { _id: "users" },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    const id = counterRes?.seq ?? 1;

    const now = new Date().toISOString();
    await users.insertOne({
      id,
      hospital_id: 1,
      radiology_center_id: null,
      lab_center_id: null,
      name,
      email,
      password_hash: await hashPassword(password),
      role: "Platform Admin",
      department_id: null,
      doctor_id: null,
      status: "Active",
      last_login_at: null,
      created_at: now,
      updated_at: now,
    });

    console.log(`Created Platform Admin user (id ${id}):`);
    console.log(`  Email:    ${email}`);
    if (!providedPassword) {
      console.log(`  Password: ${password}`);
      console.log("  (generated — save this now, it will not be shown again; rotate it after first login if you'd rather choose your own)");
    } else {
      console.log("  Password: (the one you provided in PLATFORM_ADMIN_PASSWORD)");
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
