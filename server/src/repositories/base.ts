/**
 * Generic repository over the database adapter. Provides DTO-mapped reads plus
 * raw row access for services that need to persist snake_case values.
 */
import { getDb } from "@/db";
import {
  type Filter,
  type QueryOptions,
  type Row,
} from "@/db/adapter";

export interface Repository<TRow extends Row, TDto> {
  readonly table: string;
  list(options?: QueryOptions): Promise<{ rows: TDto[]; total: number }>;
  listRows(options?: QueryOptions): Promise<{ rows: TRow[]; total: number }>;
  get(id: number | string): Promise<TDto | null>;
  getRow(id: number | string): Promise<TRow | null>;
  findRow(filters: Filter[]): Promise<TRow | null>;
  create(values: Record<string, unknown>): Promise<TRow>;
  update(
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<TRow | null>;
  remove(id: number | string): Promise<boolean>;
  count(options?: QueryOptions): Promise<number>;
}

export function createRepository<TRow extends Row, TDto>(
  table: string,
  toDto: (row: TRow) => TDto,
): Repository<TRow, TDto> {
  return {
    table,

    async list(options) {
      const db = await getDb();
      const { rows, total } = await db.list<TRow>(table, options);
      return { rows: rows.map(toDto), total };
    },

    async listRows(options) {
      const db = await getDb();
      return db.list<TRow>(table, options);
    },

    async get(id) {
      const db = await getDb();
      const row = await db.findById<TRow>(table, id);
      return row ? toDto(row) : null;
    },

    async getRow(id) {
      const db = await getDb();
      return db.findById<TRow>(table, id);
    },

    async findRow(filters) {
      const db = await getDb();
      return db.findOne<TRow>(table, filters);
    },

    async create(values) {
      const db = await getDb();
      return db.insert<TRow>(table, values);
    },

    async update(id, values) {
      const db = await getDb();
      return db.update<TRow>(table, id, values);
    },

    async remove(id) {
      const db = await getDb();
      return db.remove(table, id);
    },

    async count(options) {
      const db = await getDb();
      return db.count(table, options);
    },
  };
}
