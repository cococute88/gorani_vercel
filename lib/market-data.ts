// =============================================================
// /market live data adapter.
// Client components call this file only; it fetches the normalized
// server route and never falls back to fake/mock market curves.
// =============================================================

export type MarketRange = "6개월" | "1년" | "3년" | "5년" | "전체";
export const MARKET_RANGES: MarketRange[] = ["6개월", "1년", "3년", "5년", "전체"];

export interface BriefingItem {
  key: string;
  label: string;
  value: string;
  changePct: number | null;
  up: boolean;
  source?: "yahoo" | "unavailable" | string;
  updatedAt?: string | null;
  error?: string;
  // 실데이터 기반 미니 스파크라인(최근 daily close). 조회 실패 시 생략한다.
  sparkline?: { date: string; value: number }[];
}

export interface FearGreedData {
  score: number;
  history: { date: string; value: number }[];
  source?: string;
  updatedAt?: string | null;
  error?: string;
}

export interface EtfTemperature {
  ticker: string;
  price: number;
  changePct: number;
  drawdownPct: number;
  rsi: number;
  source?: string;
}

export interface SeriesPoint {
  date: string;
  [ticker: string]: number | string;
}

export type MarketWarning = { code: string; message: string };
export interface MarketPayload {
  source: "live" | "partial" | "unavailable";
  updatedAt: string | null;
  fearGreed: FearGreedData | null;
  briefing: BriefingItem[];
  temperatures: EtfTemperature[];
  rsi: SeriesPoint[];
  drawdown: SeriesPoint[];
  vix: SeriesPoint[];
  warnings: MarketWarning[];
}

export type FearGreedRating = "극단적 공포" | "공포" | "중립" | "탐욕" | "극단적 탐욕";

export function fearGreedRating(score: number): FearGreedRating {
  if (score < 25) return "극단적 공포";
  if (score < 45) return "공포";
  if (score < 55) return "중립";
  if (score < 75) return "탐욕";
  return "극단적 탐욕";
}

export function fearGreedColor(score: number): string {
  if (score < 25) return "#ef4444";
  if (score < 45) return "#f97316";
  if (score < 55) return "#eab308";
  if (score < 75) return "#84cc16";
  return "#22c55e";
}

const EMPTY_PAYLOAD: MarketPayload = {
  source: "unavailable",
  updatedAt: null,
  fearGreed: null,
  briefing: [],
  temperatures: [],
  rsi: [],
  drawdown: [],
  vix: [],
  warnings: [{ code: "client_fetch_failed", message: "시장 데이터 조회 불가" }],
};

export async function fetchMarketPayload(range: MarketRange): Promise<MarketPayload> {
  try {
    const response = await fetch(`/api/market?range=${encodeURIComponent(range)}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as MarketPayload;
  } catch (error) {
    return { ...EMPTY_PAYLOAD, warnings: [{ code: "client_fetch_failed", message: error instanceof Error ? error.message : String(error) }] };
  }
}
