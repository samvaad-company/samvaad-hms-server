/**
 * MongoDB database adapter.
 *
 * Implements the identical DatabaseAdapter surface against MongoDB, so
 * switching backends stays a configuration change (DATABASE_DRIVER=mongo plus
 * MONGODB_URI). Works with a local mongod or MongoDB Atlas.
 *
 * Design notes
 * ------------
 * - **Numeric ids.** The rest of the application (routes, DTOs, foreign keys
 *   such as `patient_id`) assumes auto-incrementing integer ids, exactly like
 *   the Postgres schema. Mongo's native ObjectId would break that contract, so
 *   this adapter keeps a `counters` collection and assigns sequential integer
 *   `id` values via an atomic `$inc`. Mongo's own `_id` is never exposed.
 * - **Collections == tables.** Table names map 1:1 to collection names.
 * - **Connection reuse.** The client is cached on `globalThis` so Next.js hot
 *   reloads and serverless invocations don't open a new pool per request.
 */
import { MongoClient, type Db, type Collection, type Document } from "mongodb";
import {
  type DatabaseAdapter,
  type DbChange,
  type Filter,
  type QueryOptions,
  type QueryResult,
  type Row,
} from "@/db/adapter";
import { getConfig } from "@/config/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const COUNTERS = "counters";

/** Escape a user-supplied string so it is matched literally inside a regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Query-string filters arrive as strings ("?patient_id=1") while the stored
 * value is a number. Postgres coerces this server-side; Mongo compares types
 * strictly, so a numeric-looking string must match both forms.
 */
function equalityCandidates(value: unknown): unknown[] {
  if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
    return [value, Number(value)];
  }
  if (value === "true") return [true, "true"];
  if (value === "false") return [false, "false"];
  return [value];
}

/** Translate one adapter filter into a Mongo query fragment. */
function toMongoCondition(f: Filter): Document {
  switch (f.op) {
    case "eq": {
      const candidates = equalityCandidates(f.value);
      return candidates.length > 1
        ? { [f.column]: { $in: candidates } }
        : { [f.column]: { $eq: f.value } };
    }
    case "neq": {
      const candidates = equalityCandidates(f.value);
      return candidates.length > 1
        ? { [f.column]: { $nin: candidates } }
        : { [f.column]: { $ne: f.value } };
    }
    case "gt":
      return { [f.column]: { $gt: f.value } };
    case "gte":
      return { [f.column]: { $gte: f.value } };
    case "lt":
      return { [f.column]: { $lt: f.value } };
    case "lte":
      return { [f.column]: { $lte: f.value } };
    case "in": {
      const list = Array.isArray(f.value) ? f.value : [f.value];
      return { [f.column]: { $in: list.flatMap(equalityCandidates) } };
    }
    case "is":
      return { [f.column]: { $eq: f.value } };
    case "like":
      return { [f.column]: { $regex: escapeRegex(String(f.value)) } };
    case "ilike":
      return { [f.column]: { $regex: escapeRegex(String(f.value)), $options: "i" } };
    default:
      return {};
  }
}

/** Build the full Mongo filter document for a set of query options. */
function buildFilter(options?: QueryOptions): Document {
  const and: Document[] = [];

  for (const f of options?.filters ?? []) {
    and.push(toMongoCondition(f));
  }

  const term = options?.search?.term?.trim();
  if (term && options?.search?.columns.length) {
    and.push({
      $or: options.search.columns.map((c) => ({
        [c]: { $regex: escapeRegex(term), $options: "i" },
      })),
    });
  }

  return and.length ? { $and: and } : {};
}

/** Mongo sort spec from the adapter's sort options. */
function buildSort(options?: QueryOptions): Record<string, 1 | -1> {
  const sort: Record<string, 1 | -1> = {};
  for (const s of options?.sort ?? []) {
    sort[s.column] = s.direction === "desc" ? -1 : 1;
  }
  return sort;
}

/** Strip Mongo's internal `_id`; the app only ever sees `id`. */
function clean<T>(doc: Document | null): T | null {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  void _id;
  return rest as T;
}

interface GlobalMongo {
  __samvaadMongo?: { client: MongoClient; promise: Promise<MongoClient> };
}

export class MongoAdapter implements DatabaseAdapter {
  readonly driver = "mongo";
  private readonly uri: string;
  private readonly dbName: string;
  private db: Db | null = null;

  constructor() {
    const cfg = getConfig();
    if (!cfg.mongodbUri) {
      throw new AppError(
        500,
        "INTERNAL",
        "Mongo driver selected but MONGODB_URI is not set",
      );
    }
    this.uri = cfg.mongodbUri;
    this.dbName = cfg.mongodbDb;
  }

  /** Lazily connect, reusing the pool across hot reloads / invocations. */
  private async connect(): Promise<Db> {
    if (this.db) return this.db;
    const globalRef = globalThis as unknown as GlobalMongo;

    if (!globalRef.__samvaadMongo) {
      const client = new MongoClient(this.uri);
      globalRef.__samvaadMongo = { client, promise: client.connect() };
    }
    const client = await globalRef.__samvaadMongo.promise;
    this.db = client.db(this.dbName);
    return this.db;
  }

  private async collection(table: string): Promise<Collection<Document>> {
    const db = await this.connect();
    return db.collection(table);
  }

  /**
   * Next sequential id for a collection. Atomic, so concurrent inserts never
   * collide — this is the Mongo equivalent of a Postgres identity column.
   */
  private async nextId(table: string): Promise<number> {
    const db = await this.connect();
    const res = await db.collection(COUNTERS).findOneAndUpdate(
      { _id: table as unknown as Document["_id"] },
      { $inc: { seq: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return (res?.seq as number) ?? 1;
  }

  /**
   * Keep the counter at or above an explicitly-supplied id, so seeded rows
   * (which carry their own ids) don't collide with later inserts.
   */
  private async bumpCounter(table: string, id: number): Promise<void> {
    const db = await this.connect();
    await db.collection(COUNTERS).updateOne(
      { _id: table as unknown as Document["_id"], seq: { $lt: id } },
      { $set: { seq: id } },
      { upsert: false },
    );
    await db
      .collection(COUNTERS)
      .updateOne(
        { _id: table as unknown as Document["_id"] },
        { $setOnInsert: { seq: id } },
        { upsert: true },
      );
  }

  async ready(): Promise<void> {
    const db = await this.connect();
    await db.command({ ping: 1 });
    logger.info("mongo.connected", { db: this.dbName });
  }

  async list<T extends Row>(
    table: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    const col = await this.collection(table);
    const filter = buildFilter(options);
    const total = await col.countDocuments(filter);

    let cursor = col.find(filter);
    const sort = buildSort(options);
    if (Object.keys(sort).length) cursor = cursor.sort(sort);
    if (options?.caseInsensitiveSort) cursor = cursor.collation({ locale: "en", strength: 2 });

    if (!options?.unpaged && options?.pageSize && options.pageSize > 0) {
      const page = Math.max(1, options.page ?? 1);
      cursor = cursor.skip((page - 1) * options.pageSize).limit(options.pageSize);
    }

    const docs = await cursor.toArray();
    return { rows: docs.map((d) => clean<T>(d)!), total };
  }

  async findById<T extends Row>(
    table: string,
    id: number | string,
  ): Promise<T | null> {
    const col = await this.collection(table);
    return clean<T>(await col.findOne({ id }));
  }

  async findOne<T extends Row>(
    table: string,
    filters: Filter[],
  ): Promise<T | null> {
    const col = await this.collection(table);
    return clean<T>(await col.findOne(buildFilter({ filters })));
  }

  async insert<T extends Row>(
    table: string,
    values: Record<string, unknown>,
  ): Promise<T> {
    const col = await this.collection(table);
    const explicitId = values.id as number | string | undefined;
    const id = explicitId ?? (await this.nextId(table));
    const now = new Date().toISOString();

    const doc = {
      created_at: now,
      updated_at: now,
      ...values,
      id,
    };
    await col.insertOne({ ...doc });

    // Seeded rows carry their own ids; keep the sequence ahead of them.
    if (explicitId !== undefined && typeof explicitId === "number") {
      await this.bumpCounter(table, explicitId);
    }
    return doc as unknown as T;
  }

  async update<T extends Row>(
    table: string,
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<T | null> {
    const col = await this.collection(table);
    // `id` is immutable; never let a patch rewrite it.
    const { id: _ignored, ...patch } = values;
    void _ignored;
    const res = await col.findOneAndUpdate(
      { id },
      { $set: { ...patch, updated_at: new Date().toISOString() } },
      { returnDocument: "after" },
    );
    return clean<T>(res);
  }

  // ── Shared state: sequences, rate-limit windows, change feed ─────────────────

  /**
   * One atomic update that lifts the counter to `floor` if it is behind and then adds one, so concurrent callers in any
   * number of processes each get a different value. The first call for a key creates it; two first calls racing can both try
   * to create it — the loser gets a duplicate-key error and simply retries.
   */
  async nextSequence(key: string, floor: number): Promise<number> {
    const db = await this.connect();
    const id = `seq:${key}` as unknown as Document["_id"];
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await db.collection(COUNTERS).findOneAndUpdate(
          { _id: id },
          [{ $set: { seq: { $add: [{ $max: [{ $ifNull: ["$seq", 0] }, floor] }, 1] } } }],
          { upsert: true, returnDocument: "after" },
        );
        return res?.seq as number;
      } catch (err) {
        if ((err as { code?: number }).code === 11000 && attempt < 5) continue;
        throw err;
      }
    }
  }

  async releaseSequence(key: string, value: number): Promise<void> {
    const db = await this.connect();
    await db.collection(COUNTERS).updateOne({ _id: `seq:${key}` as unknown as Document["_id"], seq: value }, { $inc: { seq: -1 } });
  }

  private hitsIndexed = false;

  private async hitsCollection(): Promise<Collection<Document>> {
    const db = await this.connect();
    const col = db.collection("rate_limits");
    if (!this.hitsIndexed) {
      // The database removes a window once it is over; `key` serves "forget this key".
      await col.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 });
      await col.createIndex({ key: 1 });
      this.hitsIndexed = true;
    }
    return col;
  }

  async countHit(key: string, windowMs: number): Promise<number> {
    const col = await this.hitsCollection();
    const bucket = Math.floor(Date.now() / windowMs);
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await col.findOneAndUpdate(
          { _id: `${key}|${bucket}` as unknown as Document["_id"] },
          { $inc: { n: 1 }, $setOnInsert: { key, expireAt: new Date((bucket + 1) * windowMs + 60_000) } },
          { upsert: true, returnDocument: "after" },
        );
        return (res?.n as number) ?? 1;
      } catch (err) {
        if ((err as { code?: number }).code === 11000 && attempt < 5) continue;
        throw err;
      }
    }
  }

  async peekHits(key: string, windowMs: number): Promise<number> {
    const col = await this.hitsCollection();
    const doc = await col.findOne({ _id: `${key}|${Math.floor(Date.now() / windowMs)}` as unknown as Document["_id"] });
    return (doc?.n as number) ?? 0;
  }

  async clearHits(key: string): Promise<void> {
    await (await this.hitsCollection()).deleteMany({ key });
  }

  /**
   * A change stream over the whole database (needs a replica set, which Atlas always is). Inserts, updates, replaces and deletes
   * are reported with the row's hospital when it can be known; the bookkeeping collections are ignored. If the stream drops it
   * is reopened from where it stopped (resume token); if that isn't possible it starts afresh and reports one change with an
   * unknown hospital, so nothing cached stays trusted across the gap.
   */
  async watchChanges(onChange: (change: DbChange) => void): Promise<(() => void) | null> {
    const db = await this.connect();
    let stopped = false;
    let resumeToken: unknown;
    let backoff = 1000;
    let current: ReturnType<Db["watch"]> | null = null;

    const open = async (first: boolean): Promise<boolean> => {
      let startupError: Error | null = null;
      let started = false;
      try {
        const stream = db.watch(
          [{ $match: { operationType: { $in: ["insert", "update", "replace", "delete"] }, "ns.coll": { $nin: [COUNTERS, "rate_limits", "_meta", "audit_log"] } } }],
          { fullDocument: "updateLookup", ...(resumeToken ? { resumeAfter: resumeToken as never } : {}) },
        );
        current = stream;
        stream.on("change", (ev: Document) => {
          resumeToken = ev._id;
          backoff = 1000;
          const hid = (ev.fullDocument as { hospital_id?: unknown } | undefined)?.hospital_id;
          const operation = ev.operationType as DbChange["operation"];
          onChange({
            table: String((ev.ns as { coll?: string } | undefined)?.coll ?? ""),
            hospitalId: typeof hid === "number" ? hid : null,
            operation,
            ...(operation === "insert" && ev.fullDocument ? { document: clean<Row>(ev.fullDocument as Document) as Record<string, unknown> } : {}),
          });
        });
        stream.on("error", (err: Error) => {
          if (!started) { startupError = err; return; }
          logger.warn("mongo.change_stream_error", { error: err.message });
          reopen();
        });
        stream.on("close", () => { if (started && !stopped) reopen(); });
        // The server answers "change streams aren't supported here" (a standalone mongod) within moments of the first request.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        started = true;
        if (startupError) throw startupError;
        return true;
      } catch (err) {
        void current?.close().catch(() => undefined);
        if (first) logger.warn("mongo.change_stream_unavailable", { error: (err as Error).message });
        return false;
      }
    };

    const reopen = () => {
      if (stopped) return;
      void current?.close().catch(() => undefined);
      setTimeout(async () => {
        if (stopped) return;
        const hadToken = resumeToken !== undefined;
        if (!(await open(false))) {
          // A resume token that has aged out can't be used; start over and tell listeners to distrust their caches.
          resumeToken = undefined;
          if (hadToken) onChange({ table: "", hospitalId: null });
          backoff = Math.min(backoff * 2, 30_000);
          reopen();
        } else if (!hadToken) onChange({ table: "", hospitalId: null });
      }, backoff);
    };

    if (!(await open(true))) return null;
    return () => { stopped = true; void current?.close().catch(() => undefined); };
  }

  async remove(table: string, id: number | string): Promise<boolean> {
    const col = await this.collection(table);
    const res = await col.deleteOne({ id });
    return res.deletedCount > 0;
  }

  async count(table: string, options?: QueryOptions): Promise<number> {
    const col = await this.collection(table);
    return col.countDocuments(buildFilter(options));
  }

  /** The connected database handle — used for index setup at startup. */
  async database(): Promise<Db> {
    return this.connect();
  }
}
