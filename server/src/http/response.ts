/**
 * Consistent API response envelopes.
 *
 * Success:   { data: T, meta?: {...} }
 * Paginated: { data: T[], meta: { page, pageSize, total, totalPages } }
 * Error:     { error: { code, message, details? } }
 */
import { ApiResponse } from "@/http/web";
import { type AppError } from "@/lib/errors";

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function ok<T>(data: T, init?: ResponseInit): ApiResponse {
  return ApiResponse.json({ data }, init);
}

export function created<T>(data: T): ApiResponse {
  return ApiResponse.json({ data }, { status: 201 });
}

export function noContent(): ApiResponse {
  return new ApiResponse(null, { status: 204 });
}

export function paginated<T>(
  data: T[],
  meta: PaginationMeta,
): ApiResponse {
  return ApiResponse.json({ data, meta });
}

export function errorResponse(err: AppError): ApiResponse {
  return ApiResponse.json(
    {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    },
    { status: err.status },
  );
}

export function makePaginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
