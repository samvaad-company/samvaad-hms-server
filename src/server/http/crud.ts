/**
 * Generic CRUD route factory. Turns a service into Next.js Route Handlers with
 * consistent auth, RBAC, validation, pagination, and error handling.
 */
import { type NextRequest, type NextResponse } from "next/server";
import { withRoute } from "@/server/http/handler";
import { parseListParams, readJson, type ListParamConfig } from "@/server/http/query";
import { ok, created, noContent, paginated, makePaginationMeta } from "@/server/http/response";
import { BadRequestError } from "@/server/lib/errors";
import { requirePermission } from "@/server/auth/server";
import { type QueryOptions } from "@/server/db/adapter";
import { type Resource } from "@/server/auth/rbac";
import { type Session } from "@/server/auth/session";

export interface CollectionConfig<TDto> {
  resource: Resource;
  listConfig: ListParamConfig;
  list: (options: QueryOptions) => Promise<{ rows: TDto[]; total: number }>;
  create?: (input: unknown, actor: Session) => Promise<TDto>;
}

export interface ItemConfig<TDto> {
  resource: Resource;
  get?: (id: number) => Promise<TDto>;
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
  const GET = withRoute(async (req: NextRequest): Promise<NextResponse> => {
    await requirePermission(config.resource, "read");
    const options = parseListParams(req, config.listConfig);
    const { rows, total } = await config.list(options);
    return paginated(
      rows,
      makePaginationMeta(options.page ?? 1, options.pageSize ?? rows.length, total),
    );
  });

  const POST = config.create
    ? withRoute(async (req: NextRequest): Promise<NextResponse> => {
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
    ? withRoute(async (_req: NextRequest, ctx: ItemCtx): Promise<NextResponse> => {
        await requirePermission(config.resource, "read");
        const { id } = await ctx.params;
        return ok(await config.get!(parseId(id)));
      })
    : undefined;

  const update = config.update
    ? withRoute(async (req: NextRequest, ctx: ItemCtx): Promise<NextResponse> => {
        const session = await requirePermission(config.resource, "write");
        const { id } = await ctx.params;
        const body = await readJson(req);
        return ok(await config.update!(parseId(id), body, session));
      })
    : undefined;

  const DELETE = config.remove
    ? withRoute(async (_req: NextRequest, ctx: ItemCtx): Promise<NextResponse> => {
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
    req: NextRequest,
    ctx: ItemCtx,
    session: Session,
  ) => Promise<NextResponse>,
) {
  return withRoute(async (req: NextRequest, ctx: ItemCtx) => {
    const session = await requirePermission(resource, action);
    return handler(req, ctx, session);
  });
}

export { parseId };
