import { NextResponse } from "next/server";
import { atlasAiEnabled } from "@/lib/server/atlas-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "autoface-web",
    version: "0.28.1",
    atlasAiConfigured: atlasAiEnabled(),
    photoStorage: process.env.NODE_ENV !== "production" && process.env.AUTOFACE_LOCAL_PHOTO_STORAGE !== "false"
      ? "local-dev"
      : "firebase",
    environment: process.env.NODE_ENV === "production" ? "production" : "development",
    timestamp: new Date().toISOString(),
  }, {
    headers: { "Cache-Control": "no-store" },
  });
}
