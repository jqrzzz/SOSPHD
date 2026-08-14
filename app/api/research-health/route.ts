import { NextResponse } from "next/server";
import { getResearchApiHealth } from "@/lib/data/health";

// Always fresh: this reports live platform state, and a cached "ok" would
// hide the exact failure the probe exists to surface.
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getResearchApiHealth();
  return NextResponse.json(health, {
    headers: { "Cache-Control": "no-store" },
  });
}
