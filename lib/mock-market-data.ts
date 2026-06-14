// =============================================================
// 시장현황 목업 데이터 (raw mock).
// market-data.ts 어댑터가 이 파일을 읽어 공급한다.
// Preview 화면 검증용 고정 데이터이며 외부 데이터 호출 없이 사용한다.
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

// VIX 변동성 기준선 (참고 그래프 reference line 에서 사용).
export const VIX_THRESHOLDS = { high: 30, watch: 20 } as const;

function seeded(n: number): number {
  const x = Math.sin(n) * 10000;
  return x - Math.floor(x);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 차트 x축용 날짜 라벨(ISO YYYY-MM-DD)을 최근 날짜에서 과거로 거슬러 생성한다.
// 6개월/1년은 주간(7일) 간격, 그 외(3년/5년/전체)는 월간 간격으로 둔다.
function buildSeriesDates(range: MarketRange): string[] {
  const n = RANGE_POINTS[range];
  const weekly = range === "6개월" || range === "1년";
  const end = new Date();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const idxFromEnd = n - 1 - i; // 0 = 가장 최근
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    if (weekly) d.setDate(d.getDate() - idxFromEnd * 7);
    else d.setMonth(d.getMonth() - idxFromEnd);
    out.push(toISODate(d));
  }
  return out;
}

/** 기간별 RSI 시계열 (mock). */
export function buildRsiSeries(range: MarketRange): SeriesPoint[] {
  const n = RANGE_POINTS[range];
  const dates = buildSeriesDates(range);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const point: SeriesPoint = { date: dates[i] };
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
  const dates = buildSeriesDates(range);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const point: SeriesPoint = { date: dates[i] };
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
  const dates = buildSeriesDates(range);
  const out: SeriesPoint[] = [];
  for (let i = 0; i < n; i++) {
    const v = 13 + Math.abs(Math.sin(i / 6)) * 12 + (seeded(i) - 0.5) * 3;
    out.push({ date: dates[i], VIX: Math.round(v * 10) / 10 });
  }
  return out;
}

export const TEMPERATURE_TICKERS = TEMP_TICKERS;

export const MARKET_TEMPERATURE_SUMMARY = {
  score: 62,
  status: "보통",
  description: "위험 선호가 과열은 아니지만 RSI와 변동성은 함께 확인해야 하는 중립 구간입니다.",
  bands: ["매우 차가움", "차가움", "보통", "뜨거움", "매우 뜨거움"],
};

export const MARKET_RISK_CARDS = [
  { label: "QQQ RSI", value: "58", sub: "중립 상단", tone: "blue" as const },
  { label: "SCHD RSI", value: "47", sub: "중립", tone: "gray" as const },
  { label: "SPY RSI", value: "55", sub: "중립", tone: "green" as const },
  { label: "VIX", value: "14.2", sub: "낮은 변동성", tone: "orange" as const },
];

export const MARKET_RSI_TREND = [
  { date: "T-10", QQQ: 44, SCHD: 42, SPY: 46 },
  { date: "T-9", QQQ: 47, SCHD: 44, SPY: 48 },
  { date: "T-8", QQQ: 51, SCHD: 45, SPY: 50 },
  { date: "T-7", QQQ: 54, SCHD: 47, SPY: 52 },
  { date: "T-6", QQQ: 56, SCHD: 48, SPY: 53 },
  { date: "T-5", QQQ: 61, SCHD: 50, SPY: 56 },
  { date: "T-4", QQQ: 63, SCHD: 49, SPY: 58 },
  { date: "T-3", QQQ: 59, SCHD: 46, SPY: 55 },
  { date: "T-2", QQQ: 57, SCHD: 48, SPY: 54 },
  { date: "T-1", QQQ: 58, SCHD: 47, SPY: 55 },
];
