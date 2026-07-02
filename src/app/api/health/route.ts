import { NextResponse } from "next/server";
import { getDb } from "@/server/db";

/** Public liveness probe — confirms the data backend is reachable. */
export async function GET(): Promise<NextResponse> {
  try {
    const db = await getDb();
    return NextResponse.json({ data: { status: "ok", driver: db.driver } });
  } catch {
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "Database unavailable" } },
      { status: 503 },
    );
  }
}
