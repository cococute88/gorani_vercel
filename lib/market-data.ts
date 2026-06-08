// =============================================================
// 시장 데이터 어댑터.
// 화면은 이 파일의 async 함수만 호출한다 (mock 반환).
// 추후 서버 API route(/api/market/...)로 교체해도 화면 코드 변경 없이 동작하도록 분리.
// 외부 API 호출이 실패해도 페이지가 깨지지 않도록 try/catch + fallback.
// TODO(codex): 실제 CNN Fear&Greed / 지수 / 환율 / yfinance RSI 연결.
// =============================================================
import {
  MOCK_BRIEFING,
  MOCK_ETF_TEMPERATURE,
  MOCK_FEAR_GREED,
  buildDrawdownSeries,
  buildRsiSeries,
  buildVixSeries,
} from "./mock-market-data";
import type {
  BriefingItem,
  EtfTemperature,
  FearGreedData,
  MarketRange,
  SeriesPoint,
} from "./mock-market-data";

export type { BriefingItem, EtfTemperature, FearGreedData, MarketRange, SeriesPoint };
export { MARKET_RANGES } from "./mock-market-data";

export type FearGreedRating =
  | "극단적 공포"
  | "공포"
  | "중립"
  | "탐욕"
  | "극단적 탐욕";

/** Fear & Greed 점수 → 등급 */
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

// 의도적으로 Promise 로 감싸 추후 fetch 로 교체 쉬운 형태
async function delay<T>(value: T): Promise<T> {
  return value;
}

export async function fetchMarketBriefing(): Promise<BriefingItem[]> {
  try {
    // TODO(codex): await fetch("/api/market/briefing")
    return await delay(MOCK_BRIEFING);
  } catch {
    return [];
  }
}

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    // TODO(codex): await fetch("/api/market/fear-greed")
    return await delay(MOCK_FEAR_GREED);
  } catch {
    return null;
  }
}

export async function fetchEtfTemperatures(): Promise<EtfTemperature[]> {
  try {
    // TODO(codex): await fetch("/api/market/etf-temperature")
    return await delay(MOCK_ETF_TEMPERATURE);
  } catch {
    return [];
  }
}

export interface RsiDrawdownResult {
  rsi: SeriesPoint[];
  drawdown: SeriesPoint[];
}

export async function fetchRsiDrawdownSeries(range: MarketRange): Promise<RsiDrawdownResult> {
  try {
    // TODO(codex): await fetch(`/api/market/rsi?range=${range}`)
    return await delay({ rsi: buildRsiSeries(range), drawdown: buildDrawdownSeries(range) });
  } catch {
    return { rsi: [], drawdown: [] };
  }
}

export async function fetchVixSeries(range: MarketRange): Promise<SeriesPoint[]> {
  try {
    // TODO(codex): await fetch(`/api/market/vix?range=${range}`)
    return await delay(buildVixSeries(range));
  } catch {
    return [];
  }
}
