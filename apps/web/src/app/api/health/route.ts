import { NextResponse } from "next/server";
import { VERDIX_CONSTANTS } from "@verdix/shared";

export async function GET() {
  return NextResponse.json({
    service: "verdix-cloud-web",
    status: "healthy",
    version: VERDIX_CONSTANTS.VERSION,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
}
