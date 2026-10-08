import { ApiResponse } from "@/http/web";
import { getDb } from "@/db";

/** Public liveness probe — confirms the data backend is reachable. */
export async function GET(): Promise<ApiResponse> {
  try {
    const db = await getDb();
    return ApiResponse.json({ data: { status: "ok", driver: db.driver } });
  } catch {
    return ApiResponse.json(
      { error: { code: "INTERNAL", message: "Database unavailable" } },
      { status: 503 },
    );
  }
}
