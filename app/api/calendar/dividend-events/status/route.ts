import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const hasPolygonApiKey = Boolean(process.env.POLYGON_API_KEY?.trim());
  return NextResponse.json({
    polygon: hasPolygonApiKey ? "available" : "missing_key",
    hasPolygonApiKey,
    rateLimitDelayMs: hasPolygonApiKey ? 12500 : undefined,
    message: hasPolygonApiKey
      ? "Polygon API Key가 설정되어 있습니다."
      : "Polygon API Key가 설정되어 있지 않습니다. 관리자에게 문의하거나 환경변수를 확인하세요.",
  });
}
