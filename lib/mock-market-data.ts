// =============================================================
// 시장현황 목업 데이터 (raw mock).
// market-data.ts 어댑터가 이 파일을 읽어 공급한다.
// TODO(codex): 서버 API route(CNN Fear&Greed, 지수/환율/원자재, yfinance RSI) 연결 시 교체.
// =============================================================

export type MarketRange = "6개월" | "1년" | "3년" | "5년" | "전체";
export const MARKET_RANGES: MarketRange[] = ["6개월", "1년", "3년", "5년", "전체"];

export interface BriefingItem {
  key: string;
  label: string;
  value: string; // 표시용 문자열
  changePct: number; // 등락률(%)
  up: boolean;
}

export const MOCK_BRIEFING: BriefingItem[] = [
  { key: "fng", label: "Fear & Greed", value: "62", changePct: 4.0, up: true },
  { key: "sp500", label: "S&P 500", value: "5,646", changePct: 0.42, up: true },
  { key: "dow", label: "Dow Jones", value: "41,250", changePct: -0.18, up: false },
  { key: "nasdaq", label: "Nasdaq", value: "17,890", changePct: 0.65, up: true },
  { key: "usdkrw", label: "USD/KRW", value: "1,372", changePct: -0.22, up: false },
  { key: "wti", label: "WTI", value: "$78.4", changePct: 1.1, up: true },
  { key: "gold", label: "Gold", value: "$2,418", changePct: 0.3, up: true },
  { key: "vix", label: "VIX", value: "14.2", changePct: -3.4, up: false },
];

export interface FearGreedData {
  score: number; // 0~100
  history: { date: string; value: number }[];
}

function buildFngHistory(): { date: string; value: number }[] {
  const out: { date: string; value: number }[] = [];
  const base = new Date("2026-05-10");
  let v = 50;
  for (let i = 0; i < 30; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    v = Math.max(5, Math.min(95, v + Math.round(Math.sin(i / 2) * 6)));
    out.push({
      date: `${d.getMonth() + 1}/${d.getDate()}`,
      value: v,
    });
  }
  return out;
}

export const MOCK_FEAR_GREED: FearGreedData = {
  score: 62,
  history: buildFngHistory(),
};

export interface EtfTemperature {
  ticker: string;
  price: number; // USD
  changePct: number;
  drawdownPct: number; // 52주 고점 대비 하락률 (음수)
  rsi: number;
}

export const MOCK_ETF_TEMPERATURE: EtfTemperature[] = [
  { ticker: "QQQ", price: 485.2, changePct: 0.62, drawdownPct: -4.1, rsi: 58 },
  { ticker: "QLD", price: 105.4, changePct: 1.25, drawdownPct: -8.3, rsi: 61 },
  { ticker: "TQQQ", price: 78.1, changePct: 1.9, drawdownPct: -13.5, rsi: 63 },
  { ticker: "SCHD", price: 28.6, changePct: -0.15, drawdownPct: -3.2, rsi: 47 },
  { ticker: "SPY", price: 560.3, changePct: 0.41, drawdownPct: -2.8, rsi: 55 },
];

export interface SeriesPoint {
  date: string;
  [ticker: string]: number | string;
}

const RANGE_POINTS: Record<MarketRange, number> = {
  "6개월": 26,
  "1년": 52,
  "3년": 36,
  "5년": 60,
  "전체": 72,
};

const TEMP_TICKERS = ["QQQ", "QLD", "TQQQ", "SCHD", "SPY"];

function seeded(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

/** 기간별 RSI 시계열 (mock). */
export function buildRsiSeries(range: MarketRange): SeriesPoint[] {
  const n = RANGE_POINTS[range];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const point: SeriesPoint = { date: `T-${n - i}` };
    TEMP_TICKERS.forEach((t, ti) => {
      const base = 50 + Math.sin(i / 4 + ti) * 18 + (seeded(i + ti * 7) - 0.5) * 8;
      point[t] = Math.round(Math.max(10, Math.min(90, base)));
    });
    out.push(point);
  }
  return out;
}

/** 기간별 고점대비 하락률 시계열 (mock, 음수 %). */
export function buildDrawdownSeries(range: MarketRange): SeriesPoint[] {
  const n = RANGE_POINTS[range];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const point: SeriesPoint = { date: `T-${n - i}` };
    TEMP_TICKERS.forEach((t, ti) => {
      const base = -(Math.abs(Math.sin(i / 5 + ti)) * (8 + ti * 3));
      point[t] = Math.round(base * 10) / 10;
    });
    out.push(point);
  }
  return out;
}

/** VIX 시계열 (mock). */
export function buildVixSeries(range: MarketRange): SeriesPoint[] {
  const n = RANGE_POINTS[range];
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const v = 13 + Math.abs(Math.sin(i / 6)) * 12 + (seeded(i) - 0.5) * 3;
    out.push({ date: `T-${n - i}`, VIX: Math.round(v * 10) / 10 });
  }
  return out;
}

export const TEMPERATURE_TICKERS = TEMP_TICKERS;
