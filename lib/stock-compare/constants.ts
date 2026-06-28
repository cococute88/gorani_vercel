// =============================================================
// 종목 성과 비교 계산기 상수: 비교 시리즈 색상/라벨, 기간 정의,
// 위험지표 레지스트리, 입력 자동완성 옵션.
// =============================================================

import type {
  ComparePeriod,
  CompareSeriesKey,
  MetricDef,
  SeriesMetrics,
} from "@/lib/stock-compare/types";
import { COMPARE_TICKER_OPTIONS, normalizeCompareTicker } from "@/lib/backtest-compare-tickers";

export { COMPARE_TICKER_OPTIONS, normalizeCompareTicker };

export const DEFAULT_COMPARE_A = "SPY";
export const DEFAULT_COMPARE_B = "QQQ";

// 전체 서비스 톤과 통일: A=파랑 / B=분홍, 중복 제거 시리즈는 점선·옅은 색.
export const SERIES_STYLE: Record<
  CompareSeriesKey,
  { color: string; dashed: boolean }
> = {
  a: { color: "#3b82f6", dashed: false }, // 파랑
  b: { color: "#ec4899", dashed: false }, // 분홍
  aEx: { color: "#0ea5e9", dashed: true }, // 옅은 파랑(중복 제거)
  bEx: { color: "#f59e0b", dashed: true }, // 주황(중복 제거)
};

export function seriesLabel(key: CompareSeriesKey, tickerA: string, tickerB: string): string {
  switch (key) {
    case "a":
      return tickerA;
    case "b":
      return tickerB;
    case "aEx":
      return `${tickerA} (중복 제거)`;
    case "bEx":
      return `${tickerB} (중복 제거)`;
  }
}

// 기간 버튼 정의. days = Infinity → MAX(전체 일별 데이터).
export const COMPARE_PERIODS: ComparePeriod[] = [
  { key: "6m", label: "6M", days: 183 },
  { key: "1y", label: "1Y", days: 365 },
  { key: "3y", label: "3Y", days: 365 * 3 },
  { key: "5y", label: "5Y", days: 365 * 5 },
  { key: "10y", label: "10Y", days: 365 * 10 },
  { key: "max", label: "MAX", days: Infinity },
];

export const DEFAULT_COMPARE_PERIOD = "1y";

// 부호 포함 % 포맷. 예: 12.53 → "+12.53%".
export function formatSignedPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

function formatPlainPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

function formatRatio(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value.toFixed(digits);
}

// 위험지표 레지스트리. 새 지표는 이 배열에 항목만 추가하면 표/토글에 자동 반영된다.
export const METRIC_DEFS: MetricDef[] = [
  {
    key: "tr",
    label: "Total Return",
    defaultOn: true,
    higherIsBetter: true,
    format: (m) => formatSignedPct(m.trPct),
    pick: (m) => m.trPct,
  },
  {
    key: "cagr",
    label: "CAGR",
    defaultOn: false,
    higherIsBetter: true,
    format: (m) => formatSignedPct(m.cagrPct),
    pick: (m) => m.cagrPct,
  },
  {
    key: "mdd",
    label: "MDD",
    defaultOn: false,
    higherIsBetter: true, // 0 에 가까울수록 좋음(값이 클수록 = 낙폭 작음).
    format: (m) => formatPlainPct(m.mddPct),
    pick: (m) => m.mddPct,
  },
  {
    key: "sharpe",
    label: "Sharpe",
    defaultOn: false,
    higherIsBetter: true,
    format: (m) => formatRatio(m.sharpe),
    pick: (m) => m.sharpe,
  },
  {
    key: "sortino",
    label: "Sortino",
    defaultOn: false,
    higherIsBetter: true,
    format: (m) => formatRatio(m.sortino),
    pick: (m) => m.sortino,
  },
  {
    key: "calmar",
    label: "Calmar",
    defaultOn: false,
    higherIsBetter: true,
    format: (m) => formatRatio(m.calmar),
    pick: (m) => m.calmar,
  },
];

export const METRIC_LABEL: Record<string, string> = METRIC_DEFS.reduce(
  (acc, def) => {
    acc[def.key] = def.label;
    return acc;
  },
  {} as Record<string, string>,
);

export function pickMetric(m: SeriesMetrics, key: string): number | null {
  return METRIC_DEFS.find((d) => d.key === key)?.pick(m) ?? null;
}
