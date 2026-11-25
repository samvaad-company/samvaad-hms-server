/** Pharmacy stock a nurse or doctor can pick from when taking medicines to a bed. */
import { actionRoute } from "@/http/crud";
import { ok } from "@/http/response";
import { searchStock } from "@/services/dispense-service";

export const GET = actionRoute("ipd", "read", async (req, _ctx, session) => ok(await searchStock(new URL(req.url, "http://localhost").searchParams.get("q"), session)));
