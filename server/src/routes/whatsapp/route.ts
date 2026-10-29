import { withRoute } from "@/http/handler";
import { readJson } from "@/http/query";
import { noContent, ok } from "@/http/response";
import { requirePermission } from "@/auth/server";
import { connectManually, disconnect, getStatus, updateSettings } from "@/services/whatsapp-service";

/** The hospital's WhatsApp connection (never the access token). */
export const GET = withRoute(async () => ok(await getStatus(await requirePermission("admin", "read"))));
/** Connect by typing in the ids and token: { wabaId, phoneNumberId, accessToken?, apiVersion? }. */
export const PUT = withRoute(async (req) => ok(await connectManually(await readJson(req), await requirePermission("admin", "write"))));
/** { botEnabled?, defaultCountry?, templateName?, templateLanguage?, templateFormat? } */
export const PATCH = withRoute(async (req) => ok(await updateSettings(await readJson(req), await requirePermission("admin", "write"))));
export const DELETE = withRoute(async () => { await disconnect(await requirePermission("admin", "write")); return noContent(); });
