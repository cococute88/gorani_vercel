import type { MoneyLevelWeather } from "./types";

export type MoneyLevelDailyClose = {
  date: string;
  close: number;
};

export type MoneyLevelRegularSession = {
  date: string;
  startEpochSeconds: number;
  endEpochSeconds: number;
};

export type MoneyLevelMarketWeatherData = {
  latestSessionDate: string;
  previousSessionDate: string;
  latestClose: number;
  previousClose: number;
  changePct: number;
  resolvedWeather: MoneyLevelWeather;
  source: "yahoo";
  fetchedAt: string;
};

const SESSION_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function resolveMoneyLevelMarketWeather(changePct: number): MoneyLevelWeather {
  if (!Number.isFinite(changePct)) throw new RangeError("SPY change must be finite");
  if (changePct >= 0) return "sunny";
  if (changePct > -1) return "cloudy";
  if (changePct > -2) return "rain";
  return "thunderstorm";
}

/**
 * Selects the latest two real provider bars that are known to be complete.
 * Missing calendar dates are intentionally ignored: weekends and exchange
 * holidays never become synthetic zero-change sessions.
 */
export function selectLatestCompletedSessionCloses(
  rows: readonly MoneyLevelDailyClose[],
  nowEpochSeconds: number,
  currentRegularSession: MoneyLevelRegularSession | null,
): [MoneyLevelDailyClose, MoneyLevelDailyClose] | null {
  if (!Number.isFinite(nowEpochSeconds)
    || !currentRegularSession
    || !SESSION_DATE_PATTERN.test(currentRegularSession.date)
    || !Number.isFinite(currentRegularSession.startEpochSeconds)
    || !Number.isFinite(currentRegularSession.endEpochSeconds)
    || currentRegularSession.endEpochSeconds <= currentRegularSession.startEpochSeconds) return null;

  const byDate = new Map<string, MoneyLevelDailyClose>();
  for (const row of rows) {
    if (!SESSION_DATE_PATTERN.test(row.date) || !Number.isFinite(row.close) || row.close <= 0) continue;
    if (row.date > currentRegularSession.date) continue;
    if (row.date === currentRegularSession.date && nowEpochSeconds < currentRegularSession.endEpochSeconds) continue;
    byDate.set(row.date, { date: row.date, close: row.close });
  }

  const completed = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  const latest = completed.at(-1);
  const previous = completed.at(-2);
  return latest && previous ? [latest, previous] : null;
}

export function buildMoneyLevelMarketWeatherData(
  sessions: [MoneyLevelDailyClose, MoneyLevelDailyClose] | null,
  fetchedAt: string,
): MoneyLevelMarketWeatherData | null {
  if (!sessions || !Number.isFinite(Date.parse(fetchedAt))) return null;
  const [latest, previous] = sessions;
  if (latest.date <= previous.date || latest.close <= 0 || previous.close <= 0) return null;
  const changePct = ((latest.close - previous.close) / previous.close) * 100;
  if (!Number.isFinite(changePct)) return null;

  return {
    latestSessionDate: latest.date,
    previousSessionDate: previous.date,
    latestClose: latest.close,
    previousClose: previous.close,
    changePct,
    resolvedWeather: resolveMoneyLevelMarketWeather(changePct),
    source: "yahoo",
    fetchedAt,
  };
}

export function isMoneyLevelMarketWeatherData(value: unknown): value is MoneyLevelMarketWeatherData {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<MoneyLevelMarketWeatherData>;
  return SESSION_DATE_PATTERN.test(item.latestSessionDate ?? "")
    && SESSION_DATE_PATTERN.test(item.previousSessionDate ?? "")
    && (item.latestSessionDate ?? "") > (item.previousSessionDate ?? "")
    && [item.latestClose, item.previousClose].every((entry) => typeof entry === "number" && Number.isFinite(entry) && entry > 0)
    && typeof item.changePct === "number"
    && Number.isFinite(item.changePct)
    && item.resolvedWeather === resolveMoneyLevelMarketWeather(item.changePct)
    && item.source === "yahoo"
    && typeof item.fetchedAt === "string"
    && Number.isFinite(Date.parse(item.fetchedAt));
}
