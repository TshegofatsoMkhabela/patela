import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
      mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID",
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
