/**
 * In-memory database adapter — the default backend for local development.
 *
 * Rows live in a module-level singleton so state persists across requests
 * within a running server process. It implements the full DatabaseAdapter
 * surface (filtering, searching, sorting, pagination) so application code is
 * identical whether it runs against memory or Supabase.
 */
import {
  type DatabaseAdapter,
  type Filter,
  type QueryOptions,
  type QueryResult,
  type Row,
} from "@/server/db/adapter";
import { logger } from "@/server/lib/logger";

interface Store {
  tables: Map<string, Row[]>;
  sequences: Map<string, number>;
  seeded: boolean;
}

// Persist across HMR reloads in dev by stashing on globalThis.
const globalRef = globalThis as unknown as { __samvaadStore?: Store };

function getStore(): Store {
  if (!globalRef.__samvaadStore) {
    globalRef.__samvaadStore = {
      tables: new Map(),
      sequences: new Map(),
      seeded: false,
    };
  }
  return globalRef.__samvaadStore;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function matchesFilter(row: Row, f: Filter): boolean {
  const v = row[f.column];
  switch (f.op) {
    case "eq":
      return v === f.value;
    case "neq":
      return v !== f.value;
    case "gt":
      return (v as number) > (f.value as number);
    case "gte":
      return (v as number) >= (f.value as number);
    case "lt":
      return (v as number) < (f.value as number);
    case "lte":
      return (v as number) <= (f.value as number);
    case "like":
      return String(v).includes(String(f.value));
    case "ilike":
      return String(v ?? "")
        .toLowerCase()
        .includes(String(f.value).toLowerCase());
    case "in":
      return Array.isArray(f.value) && f.value.includes(v);
    case "is":
      return v === f.value;
    default:
      return false;
  }
}

function applyQuery<T extends Row>(
  rows: Row[],
  options: QueryOptions | undefined,
): QueryResult<T> {
  let result = rows;

  if (options?.filters?.length) {
    result = result.filter((row) =>
      options.filters!.every((f) => matchesFilter(row, f)),
    );
  }

  if (options?.search && options.search.term.trim()) {
    const term = options.search.term.toLowerCase();
    const cols = options.search.columns;
    result = result.filter((row) =>
      cols.some((c) =>
        String(row[c] ?? "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }

  const total = result.length;

  if (options?.sort?.length) {
    result = [...result].sort((a, b) => {
      for (const s of options.sort!) {
        const av = a[s.column];
        const bv = b[s.column];
        if (av === bv) continue;
        let cmp: number;
        if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
        else cmp = String(av ?? "").localeCompare(String(bv ?? ""));
        return s.direction === "desc" ? -cmp : cmp;
      }
      return 0;
    });
  }

  if (!options?.unpaged && options?.pageSize && options.pageSize > 0) {
    const page = Math.max(1, options.page ?? 1);
    const start = (page - 1) * options.pageSize;
    result = result.slice(start, start + options.pageSize);
  }

  return { rows: result.map((r) => clone(r)) as T[], total };
}

export class MemoryAdapter implements DatabaseAdapter {
  readonly driver = "memory";

  private table(name: string): Row[] {
    const store = getStore();
    if (!store.tables.has(name)) store.tables.set(name, []);
    return store.tables.get(name)!;
  }

  private nextId(name: string): number {
    const store = getStore();
    const current = store.sequences.get(name) ?? 0;
    const next = current + 1;
    store.sequences.set(name, next);
    return next;
  }

  /** Seed the store. Idempotent — only runs once per process. */
  seed(data: Record<string, Row[]>): void {
    const store = getStore();
    if (store.seeded) return;
    for (const [name, rows] of Object.entries(data)) {
      store.tables.set(name, rows.map((r) => clone(r)));
      const maxId = rows.reduce(
        (m, r) => (typeof r.id === "number" && r.id > m ? r.id : m),
        0,
      );
      store.sequences.set(name, maxId);
    }
    store.seeded = true;
    logger.info("memory.seeded", {
      tables: Object.keys(data).length,
      rows: Object.values(data).reduce((n, r) => n + r.length, 0),
    });
  }

  async ready(): Promise<void> {
    // Seeding happens at module init via db/index.ts.
  }

  async list<T extends Row>(
    table: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    return applyQuery<T>(this.table(table), options);
  }

  async findById<T extends Row>(
    table: string,
    id: number | string,
  ): Promise<T | null> {
    const row = this.table(table).find((r) => r.id === id);
    return row ? (clone(row) as T) : null;
  }

  async findOne<T extends Row>(
    table: string,
    filters: Filter[],
  ): Promise<T | null> {
    const row = this.table(table).find((r) =>
      filters.every((f) => matchesFilter(r, f)),
    );
    return row ? (clone(row) as T) : null;
  }

  async insert<T extends Row>(
    table: string,
    values: Record<string, unknown>,
  ): Promise<T> {
    const rows = this.table(table);
    const id = (values.id as number | string) ?? this.nextId(table);
    const now = new Date().toISOString();
    const row = {
      created_at: now,
      updated_at: now,
      ...values,
      id,
    } as unknown as Row;
    rows.push(row);
    return clone(row) as T;
  }

  async update<T extends Row>(
    table: string,
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<T | null> {
    const rows = this.table(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    const updated = {
      ...rows[idx],
      ...values,
      id: rows[idx].id,
      updated_at: new Date().toISOString(),
    } as Row;
    rows[idx] = updated;
    return clone(updated) as T;
  }

  async remove(table: string, id: number | string): Promise<boolean> {
    const rows = this.table(table);
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    rows.splice(idx, 1);
    return true;
  }

  async count(table: string, options?: QueryOptions): Promise<number> {
    return applyQuery(this.table(table), { ...options, unpaged: true }).total;
  }
}
