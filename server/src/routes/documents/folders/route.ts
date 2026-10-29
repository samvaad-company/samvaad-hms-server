import { withRoute } from "@/http/handler";
import { ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { listFolders } from "@/services/mrd-documents-service";

/** The folders a document can be filed in — readable by anyone who can see documents (the patient's Documents tab). */
export const GET = withRoute(async () => ok(await listFolders(await requirePermission("documents", "read"))));
