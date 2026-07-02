/**
 * Database adapter contract.
 *
 * Every data-access path in the application goes through this interface. The
 * in-memory adapter implements it for local development; the Supabase adapter
 * implements the exact same surface against PostgREST. Swapping backends is a
 * configuration change only — see `src/server/db/index.ts`.
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
}

export interface QueryResult<T> {
  rows: T[];
  total: number;
}

/** A row is any record with a primitive id. */
export type Row = Record<string, unknown> & { id: number | string };

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
}
