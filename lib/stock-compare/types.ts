// =============================================================
// 종목 성과 비교(Stock Performance Comparison) 계산기 공용 타입.
//
// 설계 원칙
//  - 두 Yahoo Finance 티커(A/B)를 Total Return(배당 재투자 = adjClose) 기준으로
//    비교한다. ETF 의 경우 구성종목 중복을 "비중까지 반영"해 중복 제거 성과를
//    추가로 산출한다(단순 종목 삭제 금지).
//  - 모든 계산은 순수 함수로 분리하고, 컴포넌트는 결과만 표시한다.
//  - 데이터/지표/Rolling 은 향후 확장(지표 추가, 옵션 추가)을 위해
//    레지스트리·옵션 객체 형태로 설계한다.
// =============================================================

import type { LongSeriesPoint } from "@/lib/market-series";

// 화면에 그려지는 4개의 비교 시리즈 식별자.
//  - tickerA / tickerB          : 원본 Total Return
//  - tickerAExUnique / tickerBExUnique : 공통 종목을 비중까지 반영해 제거한 성과
export type CompareSeriesKey = "a" | "b" | "aEx" | "bEx";

// 누적 인덱스(기준일 = 1.0) 한 점.
export type IndexPoint = { date: string; value: number };

// 차트/카드에 공급하는 한 시리즈의 누적 성과(기준일 0%).
export type CompareSeries = {
  key: CompareSeriesKey;
  label: string;
  color: string;
  // 기준일 대비 누적 수익률(%) 시계열. (value = (index/baseIndex - 1) * 100)
  points: IndexPoint[];
  // 중복 제거 시리즈인지 여부.
  overlapAdjusted: boolean;
  // 데이터 사용 가능 여부(예: 구성종목 데이터가 없으면 aEx/bEx 는 a/b 와 동일).
  available: boolean;
};

// ── 구성종목/중복 분석 ──────────────────────────────────────

export type HoldingRow = {
  ticker: string;
  name: string;
  sector: string;
  weightPct: number;
};

export type HoldingComparisonRow = {
  rank: number;
  a: HoldingRow | null;
  b: HoldingRow | null;
};

// 한 티커의 구성종목 조회 결과 상태(원인 구분용).
//  - "ok"          : 직접 fixture 보유.
//  - "proxy"       : 동일 지수 별칭(alias)을 통해 대표 fixture 로 해석.
//  - "unsupported" : ETF 로 알려졌으나 구성종목 데이터 미보유(지원 예정/제외).
//  - "stock"       : 개별 종목이거나 미인식 티커(구성종목 개념이 없는 정상 케이스).
export type HoldingsStatus = "ok" | "proxy" | "unsupported" | "stock";

export type HoldingsResolution = {
  ticker: string;
  holdings: HoldingRow[];
  status: HoldingsStatus;
  // proxy 로 해석한 경우 원본 fixture 티커(예: IVV → SPY). 그 외 null.
  proxyOf: string | null;
};

export type OverlapResult = {
  // 두 종목 모두 구성종목(holdings) 데이터를 가졌는지.
  hasHoldings: boolean;
  // 각 티커의 조회 상태(원인 구분 안내용).
  statusA: HoldingsStatus;
  statusB: HoldingsStatus;
  // proxy 해석 시 원본 fixture 티커.
  proxyOfA: string | null;
  proxyOfB: string | null;
  // 공통 종목 목록(티커 기준 교집합).
  commonTickers: string[];
  commonCount: number;
  // A 기준 공통 종목 개수 비율(공통 수 / A 구성종목 수) * 100.
  countOverlapPctA: number;
  countOverlapPctB: number;
  // 실제 "비중 기준" 중복도. A 내 공통 종목 비중 합(%) / B 내 공통 종목 비중 합(%).
  weightOverlapPctA: number;
  weightOverlapPctB: number;
  // min-weight 기준 양방향 공통 비중(Jaccard 유사 지표, %).
  mutualWeightPct: number;
  // A·B 의 정렬된 전체 구성종목.
  holdingsA: HoldingRow[];
  holdingsB: HoldingRow[];
  // Top10 등 비교 테이블용 정렬 병합 행.
  comparisonRows: HoldingComparisonRow[];
};

// ── Rolling 1Y Total Return ─────────────────────────────────

// 월말 기준 한 시점의 4개 시리즈 Rolling 1Y TR(%) 값.
export type RollingPoint = {
  date: string; // 월말 기준일 "YYYY-MM-DD"
  a: number | null;
  b: number | null;
  aEx: number | null;
  bEx: number | null;
};

// ── 위험지표 ────────────────────────────────────────────────

export type MetricKey = "tr" | "cagr" | "mdd" | "sharpe" | "sortino" | "calmar";

export type SeriesMetrics = {
  trPct: number | null; // 기간 총수익률(%)
  cagrPct: number | null; // 연평균 성장률(%)
  mddPct: number | null; // 최대낙폭(%) (음수)
  sharpe: number | null;
  sortino: number | null;
  calmar: number | null;
};

// 향후 지표를 쉽게 추가하기 위한 레지스트리 항목.
export type MetricDef = {
  key: MetricKey;
  label: string;
  // 기본 표시 여부(TR 은 항상 on).
  defaultOn: boolean;
  // 값이 클수록 좋은 지표인지(색상/정렬 힌트).
  higherIsBetter: boolean;
  // SeriesMetrics 에서 값을 뽑아 포맷한다.
  format: (m: SeriesMetrics) => string;
  pick: (m: SeriesMetrics) => number | null;
};

// ── 구성종목 기여도 ─────────────────────────────────────────

// 선형 인덱스 분해(I = w·common + (1-w)·unique)에 따른 기여도.
// trPct = commonContribPct + uniqueContribPct (정확히 가산적).
export type ContributionBreakdown = {
  available: boolean;
  trPct: number | null;
  commonWeightPct: number; // 공통 종목 비중 합(%)
  uniqueWeightPct: number; // 비공통(고유) 비중(%) = 100 - commonWeightPct (top-holdings 기준 근사)
  commonContribPct: number | null; // 공통 종목 기여(%p)
  uniqueContribPct: number | null; // 비공통 종목 기여(%p)
};

// ── 기간 정의 ───────────────────────────────────────────────

export type ComparePeriodKey = "6m" | "1y" | "3y" | "5y" | "10y" | "max";

export type ComparePeriod = {
  key: ComparePeriodKey;
  label: string;
  days: number; // Infinity → MAX
};

// ── 전체 계산 결과(서비스 산출물) ───────────────────────────

export type RawSeries = {
  ticker: string;
  source: "yahoo" | "empty";
  // adjClose(없으면 close) 기준 TR 시계열. 오름차순.
  points: LongSeriesPoint[];
  warnings: string[];
};

export type CompareComputation = {
  tickerA: string;
  tickerB: string;
  identical: boolean;
  // 데이터 로드 상태.
  sourceA: "yahoo" | "empty";
  sourceB: "yahoo" | "empty";
  warnings: string[];
  overlap: OverlapResult;
  // 현재 선택된 옵션 반영 결과는 컴포넌트에서 useMemo 로 파생한다.
};
