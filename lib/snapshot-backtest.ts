// =============================================================
// 스냅샷 기반 "2년 역산 성과 분석" 순수 계산 로직.
//
// 포트폴리오 관리 페이지에서 선택된 스냅샷의 "계좌별 종목 비중"을 그대로 사용해
// "현재 보유(좌수)를 2년 전부터 그대로 들고 있었다면" 가정의 성과를 역산한다.
//
// 핵심 정의(2026-06 보정):
//   - 좌수(units) = 현재 평가액 / 현재가격  ← 실제 현재 보유 수량
//   - 종목 현재가치 = 좌수 × 현재가격 = 현재 평가액  ⇒ 포트폴리오 "현재 가치" = 스냅샷 평가액
//   - 당시(2년 전) 원금 = 좌수 × 2년 전 가격  (스냅샷 평가액보다 작다)
//   - 즉 그래프는 "당시 원금"에서 시작해 "현재 스냅샷 평가액"에서 끝난다.
//
// 비교(동일 원금):
//   - SPY/QQQ/KOSPI : 동일한 "당시 원금"을 2년 전에 전액 투자했다고 가정해 현재 평가.
//
// 과거(버그) 정의는 "현재 평가액을 2년 전 원금으로 보고 다시 성장"시켜 현재 가치가
// 실제 자산보다 과도하게 커졌다(start-anchor). 본 로직은 end-anchor 로 바로잡는다.
//
// 원칙:
//   - 새 가격/샘플 데이터를 만들지 않는다. 실제 가격 히스토리만 사용한다.
//   - 현금성 자산(원화 MMF/현금)은 KRW 평가액을 그대로 유지(현금 수익률 ≈ 0)한다.
//   - SGOV 등 달러 자산은 실제 가격을 사용한다(현금 취급 아님).
//   - 환율(USD/KRW) 데이터가 없으면 환율 미반영으로 계산하고 플래그를 내려준다.
//   - NaN/null/undefined 는 모든 경로에서 방어한다.
// =============================================================

export type BacktestPricePoint = { date: string; close: number };

export type BacktestEntry = {
  key: string;
  label: string;
  valueKRW: number;
  // 가격 조회용 대표 티커(우선순위 1). 현금성 자산은 null.
  ticker: string | null;
  // 가격 조회 실패 시 대체 티커(예: ACE 미국S&P500 → SPY). 없으면 null.
  proxyTicker?: string | null;
  isUsd: boolean;
  isCash: boolean;
};

export type BacktestSeriesKey = "portfolio" | "spy" | "qqq" | "kospi";

export type BacktestPoint = {
  date: string; // YYYY-MM
  portfolio: number | null;
  spy: number | null;
  qqq: number | null;
  kospi: number | null;
};

export type BacktestCard = {
  key: BacktestSeriesKey;
  label: string;
  principalKRW: number;
  currentValueKRW: number | null;
  gainKRW: number | null;
  returnPct: number | null;
  available: boolean;
};

// 종목별 계산 근거(검증/디버그용). 카드·그래프 값과 1:1로 추적 가능해야 한다.
export type BacktestBreakdownRow = {
  key: string;
  label: string;
  ticker: string | null;
  isCash: boolean;
  isUsd: boolean;
  usedProxy: boolean;
  weightPct: number; // 스냅샷 평가액 대비 비중(%)
  allocatedPrincipalKRW: number; // 당시(2년 전) 원금 = 좌수 × 2년전가격
  startPrice: number | null; // 2년 전 가격(원통화)
  endPrice: number | null; // 현재 가격(원통화)
  units: number | null; // 좌수(현재 보유 수량)
  currentValueKRW: number; // 현재 가치(= 스냅샷 평가액 분담분)
};

export type SnapshotBacktestResult = {
  available: boolean;
  unavailableReason?: string;
  // 현재 스냅샷 평가액 합(= 내 포트폴리오 현재 가치, 그래프 마지막 값과 동일).
  snapshotValueKRW: number;
  // 2년 전 동일 보유 가정 시 당시 원금(= 모든 비교선의 공통 시작 원금).
  portfolioStartKRW: number;
  points: BacktestPoint[];
  cards: Record<BacktestSeriesKey, BacktestCard>;
  breakdown: BacktestBreakdownRow[];
  fxApplied: boolean;
  warnings: string[];
  excludedTickers: string[];
  proxyTickers: string[];
};

export type BuildSnapshotBacktestInput = {
  entries: BacktestEntry[];
  priceHistories: Record<string, BacktestPricePoint[] | null | undefined>;
  benchmarkHistories: {
    spy?: BacktestPricePoint[] | null;
    qqq?: BacktestPricePoint[] | null;
    kospi?: BacktestPricePoint[] | null;
  };
  fxHistory?: BacktestPricePoint[] | null;
  months?: number;
  asOfDate?: string;
};

const DEFAULT_MONTHS = 24;

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function monthKey(date: string): string {
  return date.slice(0, 7);
}

function isValidDate(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value);
}

// 정렬된 시계열에서 target(YYYY-MM-DD) 이하의 마지막 유효 종가(asof)를 찾는다.
function asof(series: BacktestPricePoint[] | null | undefined, target: string): number | null {
  if (!series?.length) return null;
  let value: number | null = null;
  for (const point of series) {
    if (!isValidDate(point.date)) continue;
    if (point.date <= target) {
      if (Number.isFinite(point.close) && point.close > 0) value = point.close;
    } else {
      break;
    }
  }
  return value;
}

function sortSeries(series: BacktestPricePoint[] | null | undefined): BacktestPricePoint[] {
  if (!series?.length) return [];
  return [...series]
    .filter((point) => isValidDate(point.date) && Number.isFinite(point.close) && point.close > 0)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// 윈도우 구간 안에서 월별 마지막 거래일을 모은 X축 날짜 목록을 만든다.
function monthEnds(
  histories: Array<BacktestPricePoint[] | null | undefined>,
  asOfDate: string,
  months: number,
): string[] {
  const cutoff = new Date(`${asOfDate}T00:00:00Z`);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months);
  const minDate = cutoff.toISOString().slice(0, 10);
  const byMonth = new Map<string, string>();
  for (const history of histories) {
    for (const point of history ?? []) {
      if (!isValidDate(point.date)) continue;
      if (point.date < minDate || point.date > asOfDate) continue;
      byMonth.set(monthKey(point.date), point.date);
    }
  }
  return Array.from(byMonth.values()).sort();
}

function resolveHistory(
  entry: BacktestEntry,
  priceHistories: Record<string, BacktestPricePoint[] | null | undefined>,
): { history: BacktestPricePoint[] | null; usedProxy: boolean } {
  const primary = entry.ticker ? entry.ticker.toUpperCase() : null;
  if (primary && priceHistories[primary]?.length) {
    return { history: sortSeries(priceHistories[primary]), usedProxy: false };
  }
  const proxy = entry.proxyTicker ? entry.proxyTicker.toUpperCase() : null;
  if (proxy && priceHistories[proxy]?.length) {
    return { history: sortSeries(priceHistories[proxy]), usedProxy: true };
  }
  return { history: null, usedProxy: false };
}

function makeCard(
  key: BacktestSeriesKey,
  label: string,
  base: number,
  series: Array<number | null>,
): BacktestCard {
  let currentValueKRW: number | null = null;
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const value = series[i];
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      currentValueKRW = value;
      break;
    }
  }
  const available = currentValueKRW !== null && base > 0;
  const gainKRW = available ? (currentValueKRW as number) - base : null;
  const returnPct = available && base > 0 ? ((currentValueKRW as number) / base - 1) * 100 : null;
  return { key, label, principalKRW: base, currentValueKRW, gainKRW, returnPct, available };
}

function emptyResult(reason: string, snapshotValueKRW = 0): SnapshotBacktestResult {
  const card = (key: BacktestSeriesKey, label: string): BacktestCard => ({
    key,
    label,
    principalKRW: 0,
    currentValueKRW: null,
    gainKRW: null,
    returnPct: null,
    available: false,
  });
  return {
    available: false,
    unavailableReason: reason,
    snapshotValueKRW,
    portfolioStartKRW: 0,
    points: [],
    cards: {
      portfolio: card("portfolio", "내 포트폴리오"),
      spy: card("spy", "SPY 투자 시"),
      qqq: card("qqq", "QQQ 투자 시"),
      kospi: card("kospi", "KOSPI 투자 시"),
    },
    breakdown: [],
    fxApplied: false,
    warnings: [reason],
    excludedTickers: [],
    proxyTickers: [],
  };
}

// null 구간을 앞/뒤 유효값으로 채워 합산 가능한 숫자 시계열로 만든다.
// (대부분 종목은 2년 내내 가격이 있고, 상장 이전 구간만 back-fill 된다.)
function fillSeries(raw: Array<number | null>): number[] {
  const out = raw.slice();
  let last: number | null = null;
  for (let i = 0; i < out.length; i += 1) {
    if (out[i] != null) last = out[i];
    else if (last != null) out[i] = last;
  }
  let next: number | null = null;
  for (let i = out.length - 1; i >= 0; i -= 1) {
    if (out[i] != null) next = out[i];
    else if (next != null) out[i] = next;
  }
  return out.map((value) => (value == null ? 0 : value));
}

// 동일 원금을 벤치마크에 전액 투자했다고 가정한 평가액 라인.
function benchmarkLine(
  prices: BacktestPricePoint[] | null | undefined,
  months: string[],
  base: number,
  isUsd: boolean,
  fx: BacktestPricePoint[] | null | undefined,
  fxApplied: boolean,
): Array<number | null> {
  const sorted = sortSeries(prices);
  if (!sorted.length || base <= 0) return months.map(() => null);
  const startPrice = asof(sorted, months[0]);
  if (!startPrice) return months.map(() => null);
  const useFx = isUsd && fxApplied;
  const startRate = useFx ? asof(fx, months[0]) : 1;
  if (useFx && !startRate) return months.map(() => null);
  return months.map((date) => {
    const price = asof(sorted, date);
    const rate = useFx ? asof(fx, date) : 1;
    if (price && price > 0 && rate && rate > 0) {
      return base * (price / startPrice) * (useFx ? rate / (startRate as number) : 1);
    }
    return null;
  });
}

export function buildSnapshotBacktest(input: BuildSnapshotBacktestInput): SnapshotBacktestResult {
  const months = input.months ?? DEFAULT_MONTHS;
  const asOfDate = isValidDate(input.asOfDate) ? input.asOfDate : new Date().toISOString().slice(0, 10);

  const entries = (input.entries ?? []).filter((entry) => finite(entry.valueKRW) > 0);
  const snapshotValueKRW = entries.reduce((sum, entry) => sum + finite(entry.valueKRW), 0);

  if (entries.length === 0 || snapshotValueKRW <= 0) {
    return emptyResult("성과분석 데이터 부족: 이 스냅샷에 평가금액이 있는 보유종목이 없습니다.");
  }

  const fxSorted = sortSeries(input.fxHistory);
  const fxApplied = fxSorted.length > 0;

  // X축(월별) 구성: 보유종목 + 벤치마크의 모든 가격 히스토리를 합쳐 월말 날짜를 모은다.
  const resolved = entries.map((entry) => ({ entry, ...resolveHistory(entry, input.priceHistories) }));
  const axisHistories: Array<BacktestPricePoint[] | null | undefined> = [
    ...resolved.map((row) => row.history),
    input.benchmarkHistories.spy,
    input.benchmarkHistories.qqq,
    input.benchmarkHistories.kospi,
  ];
  const monthDates = monthEnds(axisHistories, asOfDate, months);

  if (monthDates.length < 2) {
    return emptyResult(
      "성과분석 데이터 부족: 최근 2년 과거 가격 데이터를 불러오지 못했습니다.",
      snapshotValueKRW,
    );
  }

  const firstMonth = monthDates[0];
  const lastMonth = monthDates[monthDates.length - 1];

  const warnings: string[] = [];
  const excludedTickers: string[] = [];
  const proxyTickers: string[] = [];
  let usedFxForHolding = false;

  // 종목별 평가액 시계열(KRW) + 계산 근거.
  // end-anchor: 좌수 = 현재 평가액 / 현재가격 → 현재 시점 평가액 = valueKRW(스냅샷 평가액).
  const computed = resolved.map(({ entry, history, usedProxy }) => {
    const valueKRW = finite(entry.valueKRW);

    const flat = (): { series: number[]; row: BacktestBreakdownRow } => ({
      series: monthDates.map(() => valueKRW),
      row: {
        key: entry.key,
        label: entry.label,
        ticker: entry.ticker,
        isCash: entry.isCash,
        isUsd: entry.isUsd,
        usedProxy: false,
        weightPct: (valueKRW / snapshotValueKRW) * 100,
        allocatedPrincipalKRW: valueKRW, // 현금성: 당시=현재(평탄)
        startPrice: null,
        endPrice: null,
        units: null,
        currentValueKRW: valueKRW,
      },
    });

    if (entry.isCash) return flat();
    if (!history || history.length === 0) {
      if (entry.ticker) excludedTickers.push(entry.ticker);
      return flat();
    }

    const endPrice = asof(history, lastMonth);
    if (!endPrice) {
      if (entry.ticker) excludedTickers.push(entry.ticker);
      return flat();
    }
    if (usedProxy && entry.proxyTicker) proxyTickers.push(entry.proxyTicker);

    const useFx = entry.isUsd && fxApplied;
    if (useFx) usedFxForHolding = true;
    const endRate = useFx ? asof(fxSorted, lastMonth) : 1;
    const safeEndRate = endRate && endRate > 0 ? endRate : 1;

    // 좌수 = 현재 평가액 / (현재가격 × 현재환율) = 실제 현재 보유 수량.
    const units = valueKRW / (endPrice * (useFx ? safeEndRate : 1));

    const raw: Array<number | null> = monthDates.map((date) => {
      const price = asof(history, date);
      const rate = useFx ? asof(fxSorted, date) : 1;
      if (price && price > 0 && rate && rate > 0) {
        const value = units * price * rate;
        return Number.isFinite(value) && value > 0 ? value : null;
      }
      return null;
    });
    const series = fillSeries(raw);
    const startPrice = asof(history, firstMonth);

    return {
      series,
      row: {
        key: entry.key,
        label: entry.label,
        ticker: entry.ticker,
        isCash: false,
        isUsd: entry.isUsd,
        usedProxy,
        weightPct: (valueKRW / snapshotValueKRW) * 100,
        allocatedPrincipalKRW: finite(series[0]), // 당시(2년 전) 원금 분담분
        startPrice: startPrice ?? null,
        endPrice,
        units,
        currentValueKRW: valueKRW,
      } satisfies BacktestBreakdownRow,
    };
  });

  const entrySeriesList = computed.map((row) => row.series);
  const breakdown = computed
    .map((row) => row.row)
    .sort((a, b) => b.currentValueKRW - a.currentValueKRW);

  const portfolioSeries = monthDates.map((_, i) =>
    entrySeriesList.reduce((sum, series) => sum + finite(series[i]), 0),
  );

  // 당시(2년 전) 원금 = 포트폴리오 시작값. 모든 비교선의 공통 시작 원금으로 사용한다.
  const portfolioStartKRW = finite(portfolioSeries[0]);

  const spySeries = benchmarkLine(input.benchmarkHistories.spy, monthDates, portfolioStartKRW, true, fxSorted, fxApplied);
  const qqqSeries = benchmarkLine(input.benchmarkHistories.qqq, monthDates, portfolioStartKRW, true, fxSorted, fxApplied);
  const kospiSeries = benchmarkLine(input.benchmarkHistories.kospi, monthDates, portfolioStartKRW, false, fxSorted, fxApplied);

  const points: BacktestPoint[] = monthDates.map((date, i) => ({
    date: monthKey(date),
    portfolio: finite(portfolioSeries[i]) > 0 ? portfolioSeries[i] : null,
    spy: spySeries[i],
    qqq: qqqSeries[i],
    kospi: kospiSeries[i],
  }));

  const cards: Record<BacktestSeriesKey, BacktestCard> = {
    portfolio: makeCard("portfolio", "내 포트폴리오", portfolioStartKRW, portfolioSeries),
    spy: makeCard("spy", "SPY 투자 시", portfolioStartKRW, spySeries),
    qqq: makeCard("qqq", "QQQ 투자 시", portfolioStartKRW, qqqSeries),
    kospi: makeCard("kospi", "KOSPI 투자 시", portfolioStartKRW, kospiSeries),
  };

  if (excludedTickers.length > 0) {
    warnings.push(
      `일부 종목의 과거 가격을 불러오지 못해 평가액을 유지값으로 처리했습니다: ${Array.from(new Set(excludedTickers)).join(", ")}`,
    );
  }
  if (proxyTickers.length > 0) {
    warnings.push(
      `일부 한국 ETF 는 대표 지수(${Array.from(new Set(proxyTickers)).join(", ")})로 대체 계산했습니다.`,
    );
  }
  const usdBenchmarkShown = cards.spy.available || cards.qqq.available;
  if ((usedFxForHolding || usdBenchmarkShown) && !fxApplied) {
    warnings.push("환율 미반영");
  }
  if (!cards.spy.available) warnings.push("SPY 가격/환율 데이터를 불러오지 못해 SPY 비교선을 표시하지 않습니다.");
  if (!cards.qqq.available) warnings.push("QQQ 가격/환율 데이터를 불러오지 못해 QQQ 비교선을 표시하지 않습니다.");
  if (!cards.kospi.available) warnings.push("KOSPI 가격 데이터를 불러오지 못해 KOSPI 비교선을 표시하지 않습니다.");

  return {
    available: true,
    snapshotValueKRW,
    portfolioStartKRW,
    points,
    cards,
    breakdown,
    fxApplied,
    warnings,
    excludedTickers: Array.from(new Set(excludedTickers)),
    proxyTickers: Array.from(new Set(proxyTickers)),
  };
}
