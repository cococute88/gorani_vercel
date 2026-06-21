// =============================================================
// 스냅샷 기반 "N년 역산 성과 분석" 순수 계산 로직.
//
// 포트폴리오 관리 페이지에서 선택된 스냅샷의 "계좌별 종목 비중"을 그대로 사용해
// "지금 보유한 좌수를 N개월 전부터 그대로 들고 있었다면" 가정의 성과를 역산한다.
//
// 계산 방향(중요):
//   - 기준점은 "현재 평가액(스냅샷 평가금액)"이다. 절대 원금으로 쓰지 않는다.
//   - 각 종목의 좌수(units)는 "현재가" 기준으로 역산한다.
//       units = 현재평가액 / (현재가 × 현재환율)
//     → 즉, 현재 시점에서 그래프의 마지막 값은 항상 스냅샷 평가액과 정확히 일치한다.
//   - 과거 시점의 평가액은 그 좌수를 과거 가격으로 재평가해서 구한다.
//       value(t) = units × price(t) × rate(t)
//     → 가장 과거(시작) 시점의 합계가 곧 "역산 원금"이다.
//   - 따라서 원금은 기간(2년/1년/6개월)에 따라 자연히 달라진다.
//
// 시리즈 정의:
//   - 내 포트폴리오 : 현재 좌수를 N개월 전부터 보유했다고 가정한 평가액 추이
//   - SPY 투자 시   : 위에서 구한 역산 원금을 전액 SPY 에 기간 전 매수
//   - QQQ 투자 시   : 동일 원금을 전액 QQQ 에 기간 전 매수
//   - (사용자 선택 티커) 투자 시 : 동일 원금을 전액 사용자가 고른 비교 티커에 기간 전 매수
//
// 원칙:
//   - 새 가격/샘플 데이터를 만들지 않는다. 실제 가격 히스토리만 사용한다.
//   - 가격이 없는 종목/구간은 0 으로 채우지 않고 마지막 유효값을 유지(현금형)하거나 제외한다.
//   - 현금성 자산(원화 MMF/현금)은 KRW 평가액을 그대로 유지(현금 수익률 ≈ 0)한다.
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

export type BacktestSeriesKey = "portfolio" | "spy" | "qqq" | "custom";

export type BacktestPoint = {
  date: string; // YYYY-MM
  portfolio: number | null;
  spy: number | null;
  qqq: number | null;
  custom: number | null;
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

export type SnapshotBacktestResult = {
  available: boolean;
  unavailableReason?: string;
  basePrincipalKRW: number;
  points: BacktestPoint[];
  cards: Record<BacktestSeriesKey, BacktestCard>;
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
    custom?: BacktestPricePoint[] | null;
  };
  fxHistory?: BacktestPricePoint[] | null;
  months?: number;
  asOfDate?: string;
  // 사용자 선택 비교 티커. 카드/범례 라벨과 USD 여부(환율 반영)를 결정한다.
  customLabel?: string;
  customTicker?: string;
  customIsUsd?: boolean;
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

function emptyResult(reason: string, base = 0, customLabel = "비교 티커 투자 시"): SnapshotBacktestResult {
  const card = (key: BacktestSeriesKey, label: string): BacktestCard => ({
    key,
    label,
    principalKRW: base,
    currentValueKRW: null,
    gainKRW: null,
    returnPct: null,
    available: false,
  });
  return {
    available: false,
    unavailableReason: reason,
    basePrincipalKRW: base,
    points: [],
    cards: {
      portfolio: card("portfolio", "내 포트폴리오"),
      spy: card("spy", "SPY 투자 시"),
      qqq: card("qqq", "QQQ 투자 시"),
      custom: card("custom", customLabel),
    },
    fxApplied: false,
    warnings: [reason],
    excludedTickers: [],
    proxyTickers: [],
  };
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
  const customTicker = (input.customTicker ?? "").toUpperCase();
  const customLabel = input.customLabel ?? (customTicker ? `${customTicker} 투자 시` : "비교 티커 투자 시");
  // 사용자 비교 티커는 별도 지정이 없으면 미국 ETF(USD)로 간주해 환율을 반영한다.
  const customIsUsd = input.customIsUsd ?? true;

  const entries = (input.entries ?? []).filter((entry) => finite(entry.valueKRW) > 0);
  // 스냅샷 현재 평가액 합계(= 그래프 마지막 값의 기준). 원금이 아니다.
  const snapshotTotalKRW = entries.reduce((sum, entry) => sum + finite(entry.valueKRW), 0);

  if (entries.length === 0 || snapshotTotalKRW <= 0) {
    return emptyResult("성과분석 데이터 부족: 이 스냅샷에 평가금액이 있는 보유종목이 없습니다.", 0, customLabel);
  }

  const fxSorted = sortSeries(input.fxHistory);
  const fxApplied = fxSorted.length > 0;

  // X축(월별) 구성: 보유종목 + 벤치마크의 모든 가격 히스토리를 합쳐 월말 날짜를 모은다.
  const resolved = entries.map((entry) => ({ entry, ...resolveHistory(entry, input.priceHistories) }));
  const axisHistories: Array<BacktestPricePoint[] | null | undefined> = [
    ...resolved.map((row) => row.history),
    input.benchmarkHistories.spy,
    input.benchmarkHistories.qqq,
    input.benchmarkHistories.custom,
  ];
  const monthDates = monthEnds(axisHistories, asOfDate, months);

  if (monthDates.length < 2) {
    return emptyResult(
      "성과분석 데이터 부족: 선택한 기간의 과거 가격 데이터를 불러오지 못했습니다.",
      snapshotTotalKRW,
      customLabel,
    );
  }

  const warnings: string[] = [];
  const excludedTickers: string[] = [];
  const proxyTickers: string[] = [];
  let usedFxForHolding = false;
  let needFxButMissing = false;

  // 현재(최근 월말) 시점. 좌수 역산과 그래프 마지막 값의 기준점이 된다.
  const lastDate = monthDates[monthDates.length - 1];

  // 종목별 평가액 시계열(KRW).
  // 좌수는 "현재가" 기준으로 역산하므로, 마지막 시점 값은 항상 현재 평가액과 일치한다.
  // 현금/가격불가 종목은 평가액을 그대로 유지한다(현금 수익률 ≈ 0).
  const entrySeriesList = resolved.map(({ entry, history, usedProxy }) => {
    const valueKRW = finite(entry.valueKRW);

    if (entry.isCash || !history || history.length === 0) {
      if (!entry.isCash && entry.ticker) excludedTickers.push(entry.ticker);
      return monthDates.map(() => valueKRW);
    }

    if (usedProxy && entry.proxyTicker) proxyTickers.push(entry.proxyTicker);

    // 현재가(최근 월말 기준)를 구할 수 없으면 평가액을 그대로 유지한다(가짜 라인 금지).
    const currentPrice = asof(history, lastDate);
    if (!currentPrice) {
      if (entry.ticker) excludedTickers.push(entry.ticker);
      return monthDates.map(() => valueKRW);
    }

    const useFx = entry.isUsd && fxApplied;
    if (entry.isUsd && !fxApplied) needFxButMissing = true;
    const currentRate = useFx ? asof(fxSorted, lastDate) : 1;
    const safeCurrentRate = currentRate && currentRate > 0 ? currentRate : 1;
    if (useFx) usedFxForHolding = true;

    // 현재 평가액(valueKRW)이 되도록 좌수(units)를 "현재가" 기준으로 역산한다.
    //   units = 현재평가액 / (현재가 × 현재환율)
    // 과거 시점은 이 좌수를 과거 가격으로 재평가 → 그 시작값이 역산 원금이 된다.
    const units = valueKRW / (currentPrice * (useFx ? safeCurrentRate : 1));

    const raw: Array<number | null> = monthDates.map((date) => {
      const price = asof(history, date);
      const rate = useFx ? asof(fxSorted, date) : 1;
      if (price && price > 0 && rate && rate > 0) {
        const value = units * price * rate;
        if (Number.isFinite(value) && value > 0) return value;
      }
      return null;
    });

    // 구간 내 빈 값은 앞/뒤 유효값으로 채워 라인에 구멍이 없도록 한다.
    // (마지막 시점은 currentPrice 가 존재하므로 항상 valueKRW 와 정확히 일치한다.)
    let prev: number | null = null;
    for (let i = 0; i < raw.length; i += 1) {
      if (raw[i] == null) raw[i] = prev;
      else prev = raw[i];
    }
    let next: number | null = null;
    for (let i = raw.length - 1; i >= 0; i -= 1) {
      if (raw[i] == null) raw[i] = next;
      else next = raw[i];
    }
    return raw.map((value) => (value == null ? valueKRW : value));
  });

  const portfolioSeries = monthDates.map((_, i) =>
    entrySeriesList.reduce((sum, series) => sum + finite(series[i]), 0),
  );

  // 역산 원금 = 가장 과거(시작) 시점의 포트폴리오 평가액 합계.
  // 기간(2년/1년/6개월)에 따라 시작 가격이 달라지므로 원금도 자연히 달라진다.
  const basePrincipalKRW = finite(portfolioSeries[0]);

  const spySeries = benchmarkLine(input.benchmarkHistories.spy, monthDates, basePrincipalKRW, true, fxSorted, fxApplied);
  const qqqSeries = benchmarkLine(input.benchmarkHistories.qqq, monthDates, basePrincipalKRW, true, fxSorted, fxApplied);
  const customSeries = benchmarkLine(
    input.benchmarkHistories.custom,
    monthDates,
    basePrincipalKRW,
    customIsUsd,
    fxSorted,
    fxApplied,
  );

  const points: BacktestPoint[] = monthDates.map((date, i) => ({
    date: monthKey(date),
    portfolio: finite(portfolioSeries[i]) > 0 ? portfolioSeries[i] : null,
    spy: spySeries[i],
    qqq: qqqSeries[i],
    custom: customSeries[i],
  }));

  const cards: Record<BacktestSeriesKey, BacktestCard> = {
    portfolio: makeCard("portfolio", "내 포트폴리오", basePrincipalKRW, portfolioSeries),
    spy: makeCard("spy", "SPY 투자 시", basePrincipalKRW, spySeries),
    qqq: makeCard("qqq", "QQQ 투자 시", basePrincipalKRW, qqqSeries),
    custom: makeCard("custom", customLabel, basePrincipalKRW, customSeries),
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
  if ((usedFxForHolding || cards.spy.available || cards.qqq.available) && !fxApplied) {
    warnings.push("환율 미반영");
  }
  if (needFxButMissing && fxApplied === false) {
    // 위 메시지에 이미 포함.
  }
  if (!cards.spy.available) warnings.push("SPY 가격/환율 데이터를 불러오지 못해 SPY 비교선을 표시하지 않습니다.");
  if (!cards.qqq.available) warnings.push("QQQ 가격/환율 데이터를 불러오지 못해 QQQ 비교선을 표시하지 않습니다.");
  if (!cards.custom.available) {
    const tickerName = customTicker || "비교 티커";
    warnings.push(`${tickerName} 가격 데이터를 불러오지 못해 비교선을 표시하지 않습니다.`);
  }

  return {
    available: true,
    basePrincipalKRW,
    points,
    cards,
    fxApplied,
    warnings,
    excludedTickers: Array.from(new Set(excludedTickers)),
    proxyTickers: Array.from(new Set(proxyTickers)),
  };
}
