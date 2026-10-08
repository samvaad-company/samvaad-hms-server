/**
 * Generic CRUD route factory. Turns a service into Next.js Route Handlers with
 * consistent auth, RBAC, validation, pagination, and error handling.
 */
import { type ApiRequest, type ApiResponse } from "@/http/web";
import { withRoute } from "@/http/handler";
import { parseListParams, readJson, type ListParamConfig } from "@/http/query";
import { ok, created, noContent, paginated, makePaginationMeta } from "@/http/response";
import { BadRequestError } from "@/lib/errors";
import { requirePermission } from "@/auth/server";
import { type QueryOptions } from "@/db/adapter";
import { type Resource } from "@/auth/rbac";
import { type Session } from "@/auth/session";

export interface CollectionConfig<TDto> {
  resource: Resource;
  listConfig: ListParamConfig;
  list: (options: QueryOptions, actor: Session) => Promise<{ rows: TDto[]; total: number }>;
  create?: (input: unknown, actor: Session) => Promise<TDto>;
}

export interface ItemConfig<TDto> {
  resource: Resource;
  get?: (id: number, actor: Session) => Promise<TDto>;
  update?: (id: number, input: unknown, actor: Session) => Promise<TDto>;
  remove?: (id: number, actor: Session) => Promise<void>;
}

type ItemCtx = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError(`Invalid id: ${raw}`);
  }
  return id;
}

/** Build the collection-level handlers (GET list, POST create). */
export function collectionRoute<TDto>(config: CollectionConfig<TDto>) {
  const GET = withRoute(async (req: ApiRequest): Promise<ApiResponse> => {
    const session = await requirePermission(config.resource, "read");
    const options = parseListParams(req, config.listConfig);
    const { rows, total } = await config.list(options, session);
    return paginated(
      rows,
      makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
    );
  });

  const POST = config.create
    ? withRoute(async (req: ApiRequest): Promise<ApiResponse> => {
        const session = await requirePermission(config.resource, "write");
        const body = await readJson(req);
        const result = await config.create!(body, session);
        return created(result);
      })
    : undefined;

  return { GET, POST };
}

/** Build the item-level handlers (GET, PUT, PATCH, DELETE). */
export function itemRoute<TDto>(config: ItemConfig<TDto>) {
  const GET = config.get
    ? withRoute(async (_req: ApiRequest, ctx: ItemCtx): Promise<ApiResponse> => {
        const session = await requirePermission(config.resource, "read");
        const { id } = await ctx.params;
        return ok(await config.get!(parseId(id), session));
      })
    : undefined;

  const update = config.update
    ? withRoute(async (req: ApiRequest, ctx: ItemCtx): Promise<ApiResponse> => {
        const session = await requirePermission(config.resource, "write");
        const { id } = await ctx.params;
        const body = await readJson(req);
        return ok(await config.update!(parseId(id), body, session));
      })
    : undefined;

  const DELETE = config.remove
    ? withRoute(async (_req: ApiRequest, ctx: ItemCtx): Promise<ApiResponse> => {
        const session = await requirePermission(config.resource, "write");
        const { id } = await ctx.params;
        await config.remove!(parseId(id), session);
        return noContent();
      })
    : undefined;

  return { GET, PUT: update, PATCH: update, DELETE };
}

/** Helper for one-off action endpoints (e.g. dispense, discharge). */
export function actionRoute(
  resource: Resource,
  action: "read" | "write",
  handler: (
    req: ApiRequest,
    ctx: ItemCtx,
    session: Session,
  ) => Promise<ApiResponse>,
) {
  return withRoute(async (req: ApiRequest, ctx: ItemCtx) => {
    const session = await requirePermission(resource, action);
    return handler(req, ctx, session);
  });
}

export { parseId };
