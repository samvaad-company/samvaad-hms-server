/**
 * Supabase (PostgREST) database adapter.
 *
 * Implements the identical DatabaseAdapter surface against Supabase's REST API
 * using `fetch` only — no client library dependency. Activated automatically
 * when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are present (or
 * DATABASE_DRIVER=supabase). Connecting Supabase is therefore a pure
 * configuration step: provide the env vars and run the SQL migrations.
 */
import {
  type DatabaseAdapter,
  type Filter,
  type FilterOp,
  type QueryOptions,
  type QueryResult,
  type Row,
} from "@/server/db/adapter";
import { getConfig } from "@/server/config/env";
import { AppError } from "@/server/lib/errors";
import { withRetry } from "@/server/http/handler";
import { logger } from "@/server/lib/logger";

const OP_MAP: Record<FilterOp, string> = {
  eq: "eq",
  neq: "neq",
  gt: "gt",
  gte: "gte",
  lt: "lt",
  lte: "lte",
  like: "like",
  ilike: "ilike",
  in: "in",
  is: "is",
};

function encodeValue(op: FilterOp, value: unknown): string {
  if (op === "in" && Array.isArray(value)) {
    return `(${value.map((v) => String(v)).join(",")})`;
  }
  if (op === "ilike" || op === "like") {
    return `*${String(value)}*`;
  }
  if (value === null) return "null";
  return String(value);
}

export class SupabaseAdapter implements DatabaseAdapter {
  readonly driver = "supabase";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly schema: string;

  constructor() {
    const cfg = getConfig();
    if (!cfg.supabaseUrl || !cfg.supabaseServiceKey) {
      throw new AppError(
        500,
        "INTERNAL",
        "Supabase driver selected but SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set",
      );
    }
    this.baseUrl = cfg.supabaseUrl.replace(/\/$/, "") + "/rest/v1";
    this.apiKey = cfg.supabaseServiceKey;
    this.schema = cfg.supabaseSchema;
  }

  private headers(extra?: Record<string, string>): HeadersInit {
    return {
      apikey: this.apiKey,
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      "Accept-Profile": this.schema,
      "Content-Profile": this.schema,
      ...extra,
    };
  }

  private buildQuery(options?: QueryOptions): URLSearchParams {
    const params = new URLSearchParams();
    params.set("select", "*");

    for (const f of options?.filters ?? []) {
      params.append(f.column, `${OP_MAP[f.op]}.${encodeValue(f.op, f.value)}`);
    }

    if (options?.search && options.search.term.trim()) {
      const clauses = options.search.columns
        .map((c) => `${c}.ilike.*${options.search!.term}*`)
        .join(",");
      params.append("or", `(${clauses})`);
    }

    for (const s of options?.sort ?? []) {
      params.append("order", `${s.column}.${s.direction}`);
    }

    if (!options?.unpaged && options?.pageSize && options.pageSize > 0) {
      const page = Math.max(1, options.page ?? 1);
      params.set("limit", String(options.pageSize));
      params.set("offset", String((page - 1) * options.pageSize));
    }

    return params;
  }

  private async request(
    path: string,
    init: RequestInit & { exactCount?: boolean } = {},
  ): Promise<{ body: unknown; total: number | null }> {
    const { exactCount, ...rest } = init;
    return withRetry(
      async () => {
        const res = await fetch(`${this.baseUrl}/${path}`, {
          ...rest,
          headers: {
            ...this.headers(
              exactCount ? { Prefer: "count=exact" } : undefined,
            ),
            ...(rest.headers ?? {}),
          },
          cache: "no-store",
        });

        if (!res.ok) {
          const text = await res.text();
          logger.error("supabase.error", { status: res.status, text, path });
          throw new AppError(
            res.status >= 500 ? 502 : res.status,
            "INTERNAL",
            `Supabase request failed (${res.status})`,
            text,
          );
        }

        let total: number | null = null;
        const range = res.headers.get("content-range");
        if (range) {
          const slash = range.split("/")[1];
          if (slash && slash !== "*") total = Number(slash);
        }

        const body = res.status === 204 ? null : await res.json();
        return { body, total };
      },
      { label: `supabase:${path}` },
    );
  }

  async ready(): Promise<void> {
    // PostgREST is stateless; nothing to warm up. A cheap call validates creds.
    await this.request(`${TABLE_PROBE}?select=id&limit=1`).catch(() => {
      // Probe failures are non-fatal at startup; real calls will surface them.
    });
  }

  async list<T extends Row>(
    table: string,
    options?: QueryOptions,
  ): Promise<QueryResult<T>> {
    const params = this.buildQuery(options);
    const { body, total } = await this.request(`${table}?${params}`, {
      method: "GET",
      exactCount: true,
    });
    const rows = (body as T[]) ?? [];
    return { rows, total: total ?? rows.length };
  }

  async findById<T extends Row>(
    table: string,
    id: number | string,
  ): Promise<T | null> {
    const { body } = await this.request(`${table}?id=eq.${id}&limit=1`, {
      method: "GET",
    });
    const rows = (body as T[]) ?? [];
    return rows[0] ?? null;
  }

  async findOne<T extends Row>(
    table: string,
    filters: Filter[],
  ): Promise<T | null> {
    const params = this.buildQuery({ filters, pageSize: 1 });
    const { body } = await this.request(`${table}?${params}`, {
      method: "GET",
    });
    const rows = (body as T[]) ?? [];
    return rows[0] ?? null;
  }

  async insert<T extends Row>(
    table: string,
    values: Record<string, unknown>,
  ): Promise<T> {
    const { body } = await this.request(table, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(values),
    });
    const rows = (body as T[]) ?? [];
    return rows[0];
  }

  async update<T extends Row>(
    table: string,
    id: number | string,
    values: Record<string, unknown>,
  ): Promise<T | null> {
    const { body } = await this.request(`${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(values),
    });
    const rows = (body as T[]) ?? [];
    return rows[0] ?? null;
  }

  async remove(table: string, id: number | string): Promise<boolean> {
    await this.request(`${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    return true;
  }

  async count(table: string, options?: QueryOptions): Promise<number> {
    const result = await this.list(table, {
      ...options,
      pageSize: 1,
      page: 1,
    });
    return result.total;
  }
}

/** A table we know always exists, used only for the startup probe. */
const TABLE_PROBE = "hospital_settings";
