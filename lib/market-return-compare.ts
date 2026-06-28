// =============================================================
// Market 페이지 "수익률 비교(Benchmark)" 차트 데이터 어댑터.
//
// QQQ / SPY / SCHD 세 ETF의 일별 종가를 기준 시점 대비 누적 수익률(%)
// 로 환산해 TradingView 스타일 비교 차트에 공급한다.
//
// 설계 원칙
//  - 데이터 밀도: 월/주 축약 없이 항상 "일별" 종가를 사용한다. Yahoo range
//    토큰의 "max"는 월봉으로 강등되므로, period1/period2(interval=1d) 로
//    전체 일별 히스토리를 받는 /api/market/long-series 를 재사용한다.
//  - 성능: 심볼별 전체 일별 시계열을 한 번만 받아(fetchLongSeries 내부 캐시)
//    기간 변경 시에는 클라이언트에서 슬라이스/재계산만 한다. 즉 기간 버튼을
//    아무리 눌러도 추가 API 호출이 없다.
//  - 기준값: 선택한 기간의 "공통 시작일"(세 시계열이 모두 존재하는 가장 늦은
//    첫 거래일) 종가를 0% 로 맞춰 동일 기준에서 비교한다. MAX 에서 SCHD
//    상장(2011) 이전 구간은 자연스럽게 공통 시작일로 정렬된다.
// =============================================================

import { fetchLongSeries, type LongSeriesPoint } from "@/lib/market-series";

// 비교 대상 ETF 와 고정 색상.
//  - SCHD → 주황색 / SPY → 파란색 / QQQ → 분홍색
// 색상은 전체 서비스에서 동일하게 유지하기 위한 단일 소스(SSOT)다.
export type ReturnCompareTicker = {
  key: string;
  label: string;
  color: string;
};

export const RETURN_COMPARE_TICKERS: ReturnCompareTicker[] = [
  { key: "QQQ", label: "QQQ", color: "#ec4899" }, // 분홍색
  { key: "SPY", label: "SPY", color: "#3b82f6" }, // 파란색
  { key: "SCHD", label: "SCHD", color: "#f59e0b" }, // 주황색
];

export const RETURN_COMPARE_COLORS: Record<string, string> = RETURN_COMPARE_TICKERS.reduce(
  (acc, t) => {
    acc[t.key] = t.color;
    return acc;
  },
  {} as Record<string, string>,
);

// 전체 일별 히스토리를 받을 때 사용하는 고정 시작일. SCHD 상장(2011-10)
// 이전이지만, 요청 URL 을 안정적으로 캐시하기 위해 이른 바닥값으로 고정한다.
const HISTORY_START_ISO = "2010-01-01";

const DAY_MS = 86_400_000;

// 기간 선택 정의. days = Infinity → MAX(전체 일별 데이터).
export type ReturnPeriod = {
  label: string;
  key: string;
  days: number;
};

export const RETURN_PERIODS: ReturnPeriod[] = [
  { label: "1M", key: "1m", days: 31 },
  { label: "3M", key: "3m", days: 92 },
  { label: "6M", key: "6m", days: 183 },
  { label: "1Y", key: "1y", days: 365 },
  { label: "3Y", key: "3y", days: 365 * 3 },
  { label: "MAX", key: "max", days: Infinity },
];

export const DEFAULT_RETURN_PERIOD = "6m";

export function periodDaysOf(key: string): number {
  return RETURN_PERIODS.find((p) => p.key === key)?.days ?? 183;
}

// 심볼별 원본 일별 종가 시계열(오름차순).
export type ReturnCompareRaw = {
  byKey: Record<string, LongSeriesPoint[]>;
  source: "yahoo" | "empty" | "mixed";
  warnings: string[];
};

// 차트에 그릴 한 종목의 누적 수익률 시계열.
export type ReturnPoint = { date: string; value: number };
export type ReturnCompareSeries = {
  key: string;
  label: string;
  color: string;
  points: ReturnPoint[];
};

function parseIsoMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

// 세 ETF 의 전체 일별 히스토리를 한 번에 받는다. fetchLongSeries 가 심볼+시작일
// 단위로 in-memory 캐시하므로, 인라인 차트와 상세 모달이 동일 데이터를 공유하고
// 재호출이 발생하지 않는다.
export async function fetchReturnCompareRaw(): Promise<ReturnCompareRaw> {
  const results = await Promise.all(
    RETURN_COMPARE_TICKERS.map((t) =>
      fetchLongSeries(t.key, HISTORY_START_ISO)
        .then((res) => ({ key: t.key, res }))
        .catch((error) => ({
          key: t.key,
          res: {
            symbol: t.key,
            source: "empty" as const,
            updatedAt: new Date().toISOString(),
            start: HISTORY_START_ISO,
            points: [] as LongSeriesPoint[],
            dividends: [],
            warnings: [error instanceof Error ? error.message : String(error)],
          },
        })),
    ),
  );

  const byKey: Record<string, LongSeriesPoint[]> = {};
  const warnings: string[] = [];
  let yahoo = 0;
  let empty = 0;
  for (const { key, res } of results) {
    byKey[key] = res.points ?? [];
    if (res.warnings?.length) warnings.push(`${key}: ${res.warnings.join("; ")}`);
    if (res.source === "yahoo" && (res.points?.length ?? 0) > 0) yahoo += 1;
    else empty += 1;
  }
  const source: ReturnCompareRaw["source"] = empty === 0 ? "yahoo" : yahoo === 0 ? "empty" : "mixed";
  return { byKey, source, warnings };
}

// 원본 일별 종가를 선택 기간 기준 누적 수익률(%)로 환산한다.
//  1) 전 종목 통틀어 가장 최근 거래일(lastMs)을 구하고 cutoff = lastMs - days.
//  2) 각 종목을 cutoff 이후로 필터한다.
//  3) 세 종목이 모두 데이터를 가지는 "공통 시작일" = 각 필터 결과 첫 날짜 중
//     가장 늦은 날짜로 정렬한다(동일 기준 0% 보장).
//  4) 공통 시작일 종가를 base 로 (close/base - 1) * 100 을 계산한다.
export function computeReturnCompareSeries(
  raw: ReturnCompareRaw | null,
  periodDays: number,
): ReturnCompareSeries[] {
  const empty = RETURN_COMPARE_TICKERS.map((t) => ({ ...t, points: [] as ReturnPoint[] }));
  if (!raw) return empty;

  let lastMs = -Infinity;
  for (const t of RETURN_COMPARE_TICKERS) {
    const pts = raw.byKey[t.key];
    if (pts && pts.length) {
      const ms = parseIsoMs(pts[pts.length - 1].date);
      if (Number.isFinite(ms) && ms > lastMs) lastMs = ms;
    }
  }
  if (!Number.isFinite(lastMs)) return empty;

  const cutoffMs = Number.isFinite(periodDays) ? lastMs - periodDays * DAY_MS : -Infinity;

  // 기간 필터.
  const filtered: Record<string, LongSeriesPoint[]> = {};
  for (const t of RETURN_COMPARE_TICKERS) {
    const pts = raw.byKey[t.key] ?? [];
    filtered[t.key] = pts.filter((p) => parseIsoMs(p.date) >= cutoffMs);
  }

  // 공통 시작일(세 시계열이 모두 존재하는 가장 늦은 첫 거래일).
  let commonStart = "";
  for (const t of RETURN_COMPARE_TICKERS) {
    const f = filtered[t.key];
    if (f.length) {
      const first = f[0].date;
      if (first > commonStart) commonStart = first;
    }
  }

  return RETURN_COMPARE_TICKERS.map((t) => {
    const f = (filtered[t.key] ?? []).filter((p) => p.date >= commonStart);
    const base = f.length ? f[0].close : null;
    const points: ReturnPoint[] =
      base && base > 0
        ? f.map((p) => ({ date: p.date, value: Number(((p.close / base - 1) * 100).toFixed(4)) }))
        : [];
    return { key: t.key, label: t.label, color: t.color, points };
  });
}

// 수익률 % 포맷(부호 포함). 예: 12.53 → "+12.53%", -3.1 → "−3.10%".
export function formatReturnPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}
