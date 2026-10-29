import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { ok, created } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listFolders, createFolder } from "@/services/mrd-documents-service";

export const GET = withRoute(async () => ok(await listFolders(await requirePermission("mrd", "read"))));

export const POST = withRoute(async (req) => {
  const session = await requirePermission("mrd", "write");
  return created(await createFolder(await readJson(req), session));
});
