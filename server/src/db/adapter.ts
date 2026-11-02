/**
 * Database adapter contract.
 *
 * Every data-access path in the application goes through this interface. The
 * in-memory adapter implements it for local development; the Supabase adapter
 * implements the exact same surface against PostgREST. Swapping backends is a
 * configuration change only — see `server/src/db/index.ts`.
 */

export type FilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "is";

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface SearchSpec {
  /** Columns to OR-match with a case-insensitive substring. */
  columns: string[];
  term: string;
}

export interface SortSpec {
  column: string;
  direction: "asc" | "desc";
}

export interface QueryOptions {
  filters?: Filter[];
  search?: SearchSpec;
  sort?: SortSpec[];
  page?: number;
  pageSize?: number;
  /** When true, ignore pagination and return all matching rows. */
  unpaged?: boolean;
  /** Order text columns without regard to case ("david" beside "Dev"); MongoDB otherwise sorts capitals first. */
  caseInsensitiveSort?: boolean;
}

export interface QueryResult<T> {
  rows: T[];
  total: number;
}

/** A row is any record with a primitive id. */
export type Row = Record<string, unknown> & { id: number | string };

/** One write seen by `watchChanges`. `document` is the new row, for inserts only. */
export interface DbChange {
  table: string;
  hospitalId: number | null;
  operation?: "insert" | "update" | "replace" | "delete";
  document?: Record<string, unknown>;
}

export interface DatabaseAdapter {
  /** Human-readable driver name, for diagnostics. */
  readonly driver: string;

  list<T extends Row>(
    table: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>>;

  findById<T extends Row>(
    table: string,
    id: number | string,
  ): Promise<T | null>;

  findOne<T extends Row>(
    table: string,
    filters: Filter[],
  ): Promise<T | null>;

  insert<T extends Row>(
    table: string,
    values: Record<string, unknown>,
  ): Promise<T>;

  update<T extends Row>(
    table: string,
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<T | null>;

  remove(table: string, id: number | string): Promise<boolean>;

  count(table: string, options?: QueryOptions): Promise<number>;

  /** Ensure the backend is reachable / seeded. */
  ready(): Promise<void>;

  // ── Shared state ───────────────────────────────────────────────────────────
  // Optional: a driver that implements these keeps the state in the database, so several API processes share it. When a
  // driver doesn't, callers fall back to per-process state (fine for a single server).

  /**
   * Atomically hand out the next value of a named sequence: one more than the larger of the stored value and `floor`.
   * Two callers — in this process or another — never receive the same value.
   */
  nextSequence?(key: string, floor: number): Promise<number>;

  /** Give back `value` if it is still the latest one handed out (so a failed save doesn't leave a gap). */
  releaseSequence?(key: string, value: number): Promise<void>;

  /** Count one event for `key` in the current fixed time window and return the count so far. Windows expire by themselves. */
  countHit?(key: string, windowMs: number): Promise<number>;

  /** The count so far in the current window, without counting. */
  peekHits?(key: string, windowMs: number): Promise<number>;

  /** Forget every window of `key`. */
  clearHits?(key: string): Promise<void>;

  /**
   * Call `onChange` whenever a row is written by anyone (any process, any tool). `hospitalId` is null when unknown.
   * Returns a function that stops listening, or null when the driver can't watch for changes.
   */
  watchChanges?(onChange: (change: DbChange) => void): Promise<(() => void) | null>;
}
