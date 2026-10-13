/**
 * Typed fetch client for the Samvaad HMS API.
 *
 * Wraps the standard response envelopes ({ data } / { data, meta } / { error })
 * and surfaces failures as `ApiClientError` with a stable code and any field
 * validation details.
 */
import type { PaginationMeta } from "@/types/api";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Field → message map when the failure was a validation error. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const fields = (this.details as { fields?: { field: string; message: string }[] })
      ?.fields;
    if (Array.isArray(fields)) {
      for (const f of fields) out[f.field] = f.message;
    }
    return out;
  }
}

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

function buildQuery(params?: QueryParams): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/**
 * Called after any successful write (POST/PUT/PATCH/DELETE) so the data cache can
 * refresh what the write may have changed. Set once by the store provider.
 */
let mutationListener: (() => void) | null = null;
export function setMutationListener(fn: (() => void) | null): void {
  mutationListener = fn;
}
/** Writes that don't change hospital data, so they don't need to refresh the cache. */
const NO_REFRESH = /^\/(auth\/(login|logout)|chat|scribe)(\/|$)/;

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; params?: QueryParams } = {},
): Promise<unknown> {
  const res = await fetch(`/api${path}${buildQuery(options.params)}`, {
    method,
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined,
    credentials: "same-origin",
  });

  if (res.status === 204) {
    if (method !== "GET" && !NO_REFRESH.test(path)) mutationListener?.();
    return undefined;
  }

  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const err = (json as { error?: { code: string; message: string; details?: unknown } })?.error;
    // A 401 anywhere means the session expired — bounce to login.
    if (res.status === 401 && typeof window !== "undefined") {
      const next = window.location.pathname;
      // Public pages (login, the patient booking link) have no session to lose.
      if (!next.startsWith("/login") && !next.startsWith("/book-video")) {
        window.location.href = `/login?next=${encodeURIComponent(next)}`;
      }
    }
    throw new ApiClientError(
      res.status,
      err?.code ?? "ERROR",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }

  if (method !== "GET" && !NO_REFRESH.test(path)) mutationListener?.();
  return json;
}

export interface ListResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const api = {
  /** GET a paginated list. */
  async list<T>(path: string, params?: QueryParams): Promise<ListResult<T>> {
    const json = (await request("GET", path, { params })) as ListResult<T>;
    return {
      data: json?.data ?? [],
      meta: json?.meta ?? { page: 1, pageSize: 0, total: 0, totalPages: 0 },
    };
  },

  /** GET a single resource (returns the unwrapped data). */
  async get<T>(path: string, params?: QueryParams): Promise<T> {
    const json = (await request("GET", path, { params })) as { data: T };
    return json.data;
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const json = (await request("POST", path, { body })) as { data: T };
    return json?.data;
  },

  async put<T>(path: string, body?: unknown): Promise<T> {
    const json = (await request("PUT", path, { body })) as { data: T };
    return json?.data;
  },

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const json = (await request("PATCH", path, { body })) as { data: T };
    return json?.data;
  },

  async del(path: string): Promise<void> {
    await request("DELETE", path);
  },
};
