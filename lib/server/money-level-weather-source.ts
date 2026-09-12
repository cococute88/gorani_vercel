import "server-only";

import {
  buildMoneyLevelMarketWeatherData,
  selectLatestCompletedSessionCloses,
  type MoneyLevelDailyClose,
  type MoneyLevelMarketWeatherData,
  type MoneyLevelRegularSession,
} from "@/lib/money-level/market-weather";
import { fetchYahooChart } from "@/lib/server/quote-fetchers";

const SPY_SYMBOL = "SPY";
const NEW_YORK_TIME_ZONE = "America/New_York";
type YahooChartResult = NonNullable<
  NonNullable<Awaited<ReturnType<typeof fetchYahooChart>>["chart"]>["result"]
>[number];

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function marketDateFromEpoch(epochSeconds: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NEW_YORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(epochSeconds * 1000));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseRegularSession(result: YahooChartResult): MoneyLevelRegularSession | null {
  const regular = result.meta?.currentTradingPeriod?.regular;
  if (!finitePositive(regular?.start) || !finitePositive(regular?.end) || regular.end <= regular.start) return null;
  return {
    date: marketDateFromEpoch(regular.start),
    startEpochSeconds: regular.start,
    endEpochSeconds: regular.end,
  };
}

export async function getMoneyLevelMarketWeather(): Promise<MoneyLevelMarketWeatherData> {
  const payload = await fetchYahooChart({ ticker: SPY_SYMBOL, range: "1m", events: "history" });
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error("SPY daily chart returned no result");

  const timestamps = result.timestamp ?? [];
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const rows: MoneyLevelDailyClose[] = timestamps.flatMap((timestamp, index) => {
    const close = closes[index];
    return finitePositive(timestamp) && finitePositive(close)
      ? [{ date: marketDateFromEpoch(timestamp), close }]
      : [];
  });

  const fetchedAt = new Date().toISOString();
  const sessions = selectLatestCompletedSessionCloses(
    rows,
    Math.floor(Date.now() / 1000),
    parseRegularSession(result),
  );
  const weather = buildMoneyLevelMarketWeatherData(sessions, fetchedAt);
  if (!weather) throw new Error("SPY latest two completed daily closes are unavailable");
  return weather;
}
