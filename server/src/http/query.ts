/**
 * Parse standard list query parameters (pagination, sorting, search, filters)
 * from a request URL into a `QueryOptions` object understood by every adapter.
 *
 * Supported params:
 *   ?page=1&pageSize=20
 *   ?sort=created_at:desc,name:asc
 *   ?search=term            (matched against `searchColumns`)
 *   ?<column>=<value>       (equality filter, only for whitelisted columns)
 */
import { type ApiRequest } from "@/http/web";
import { type Filter, type QueryOptions, type SortSpec } from "@/db/adapter";

export interface ListParamConfig {
  /** Columns the free-text `search` param scans. */
  searchColumns?: string[];
  /** Columns allowed as equality filters via `?col=value`. */
  filterable?: string[];
  /** Columns allowed in `sort`. */
  sortable?: string[];
  /** Default sort applied when none supplied. */
  defaultSort?: SortSpec[];
  defaultPageSize?: number;
  maxPageSize?: number;
}

export function parseListParams(
  req: ApiRequest,
  config: ListParamConfig = {},
): QueryOptions {
  const sp = new URL(req.url).searchParams;
  const {
    searchColumns = [],
    filterable = [],
    sortable = [],
    defaultSort,
    defaultPageSize = 50,
    maxPageSize = 200,
  } = config;

  // Pagination
  const unpaged = sp.get("all") === "true";
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, Number(sp.get("pageSize") ?? defaultPageSize) || defaultPageSize),
  );

  // Sorting
  let sort: SortSpec[] | undefined = defaultSort;
  const sortParam = sp.get("sort");
  if (sortParam) {
    const parsed = sortParam
      .split(",")
      .map((part) => {
        const [column, dir] = part.split(":");
        return {
          column: column.trim(),
          direction: dir?.trim() === "desc" ? "desc" : "asc",
        } as SortSpec;
      })
      .filter((s) => sortable.length === 0 || sortable.includes(s.column));
    if (parsed.length) sort = parsed;
  }

  // Search
  const term = sp.get("search")?.trim();
  const search =
    term && searchColumns.length
      ? { columns: searchColumns, term }
      : undefined;

  // Equality filters
  const filters: Filter[] = [];
  for (const col of filterable) {
    const val = sp.get(col);
    if (val !== null && val !== "" && val.toLowerCase() !== "all") {
      filters.push({ column: col, op: "eq", value: val });
    }
  }

  return {
    page,
    pageSize,
    unpaged,
    sort,
    search,
    filters: filters.length ? filters : undefined,
  };
}

/** Read and JSON-parse a request body, tolerating empty bodies. */
export async function readJson(req: ApiRequest): Promise<unknown> {
  try {
    const text = await req.text();
    if (!text) return {};
    return JSON.parse(text);
  } catch {
    return {};
  }
}
