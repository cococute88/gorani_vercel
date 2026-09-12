import { NextResponse } from "next/server";
import { getMoneyLevelMarketWeather } from "@/lib/server/money-level-weather-source";

export const dynamic = "force-dynamic";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=900, stale-while-revalidate=21600",
};

export async function GET() {
  try {
    return NextResponse.json({ data: await getMoneyLevelMarketWeather() }, { headers: CACHE_HEADERS });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") console.warn("[Money Level] SPY weather unavailable", error);
    return NextResponse.json(
      { data: null, error: "market_weather_unavailable" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}
