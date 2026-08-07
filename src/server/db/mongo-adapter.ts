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
  type Filter,
  type QueryOptions,
  type QueryResult,
  type Row,
} from "@/server/db/adapter";
import { getConfig } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";
import { logger } from "@/server/lib/logger";

const COUNTERS = "counters";

/** Escape a user-supplied string so it is matched literally inside a regex. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Translate one adapter filter into a Mongo query fragment. */
function toMongoCondition(f: Filter): Document {
  switch (f.op) {
    case "eq":
      return { [f.column]: { $eq: f.value } };
    case "neq":
      return { [f.column]: { $ne: f.value } };
    case "gt":
      return { [f.column]: { $gt: f.value } };
    case "gte":
      return { [f.column]: { $gte: f.value } };
    case "lt":
      return { [f.column]: { $lt: f.value } };
    case "lte":
      return { [f.column]: { $lte: f.value } };
    case "in":
      return { [f.column]: { $in: Array.isArray(f.value) ? f.value : [f.value] } };
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
