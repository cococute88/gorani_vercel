import { computeBacktestRiskMetrics, TRADING_DAYS_PER_YEAR } from "@/lib/backtest-risk-metrics";
import type {
  PortfolioCompareRequest,
  PortfolioCompareResult,
  PortfolioHoldingInput,
  PortfolioHoldingResult,
  PortfolioMetrics,
  PortfolioResult,
  PortfolioValuePoint,
  ResolvedMarketSeries,
  RollingSummary,
  YearlyReturnRow,
} from "@/lib/portfolio-compare/types";
import { normalizePortfolioTicker, validatePortfolioCompareRequest } from "@/lib/portfolio-compare/validation";

const DAY_MS = 86_400_000;
const MAX_FORWARD_FILL_DAYS = 10;
// Yahoo KRW=X 장기 원본에는 2008-07-30~2008-08-25의 26일 공백이 있다.
// 고정환율을 만들지 않고 마지막 실제 관측치만 최대 31일까지 제한적으로 유지한다.
const MAX_FX_FORWARD_FILL_DAYS = 31;
export const PORTFOLIO_ROLLING_MONTHS = [12, 36, 60, 120, 180, 240, 360] as const;

type LevelPoint = { date: string; level: number };
type AssetPathPoint = { date: string; level: number; virtual: boolean };

export function portfolioSeriesKey(market: "US" | "KR", ticker: string): string {
  return `${market}:${normalizePortfolioTicker(ticker, market)}`;
}

function dateMs(date: string): number {
  return new Date(`${date}T00:00:00Z`).getTime();
}

function daysBetween(a: string, b: string): number {
  return Math.round((dateMs(b) - dateMs(a)) / DAY_MS);
}

function round(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function finitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function asOf(points: LevelPoint[], date: string, maxGapDays = MAX_FORWARD_FILL_DAYS): LevelPoint | null {
  let lo = 0;
  let hi = points.length - 1;
  let found: LevelPoint | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].date <= date) {
      found = points[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (!found || daysBetween(found.date, date) > maxGapDays) return null;
  return found;
}

function buildFxLevels(fxSeries: ResolvedMarketSeries | null): LevelPoint[] {
  return (fxSeries?.points ?? [])
    .filter((point) => finitePositive(point.close))
    .map((point) => ({ date: point.date, level: point.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function buildConvertedLevels(
  series: ResolvedMarketSeries,
  request: PortfolioCompareRequest,
  fxLevels: LevelPoint[],
): LevelPoint[] {
  const validAdjusted = series.points.filter((point) => finitePositive(point.adjClose)).length;
  if (request.returnMode === "tr" && validAdjusted / Math.max(1, series.points.length) < 0.98) {
    throw new Error(
      `${series.requestedTicker}(${series.resolvedSymbol})의 신뢰할 수 있는 조정종가가 부족해 TR을 계산할 수 없습니다. PR로 전환해 주세요.`,
    );
  }

  const byDate = new Map<string, number>();
  for (const point of series.points) {
    const native = request.returnMode === "tr" ? point.adjClose : point.close;
    if (!finitePositive(native)) continue;
    let converted = native;
    if (series.currency !== request.baseCurrency) {
      const fx = asOf(fxLevels, point.date, MAX_FX_FORWARD_FILL_DAYS);
      if (!fx) continue;
      converted = series.currency === "USD" ? native * fx.level : native / fx.level;
    }
    if (finitePositive(converted)) byDate.set(point.date, converted);
  }
  const levels = Array.from(byDate, ([date, level]) => ({ date, level })).sort((a, b) => a.date.localeCompare(b.date));
  if (levels.length < 2) {
    throw new Error(`${series.requestedTicker}(${series.resolvedSymbol})의 ${request.returnMode.toUpperCase()}·${request.baseCurrency} 시계열이 부족합니다.`);
  }
  return levels;
}

function getSeries(
  map: Map<string, ResolvedMarketSeries>,
  holding: Pick<PortfolioHoldingInput, "market" | "ticker">,
): ResolvedMarketSeries {
  const series = map.get(portfolioSeriesKey(holding.market, holding.ticker));
  if (!series) throw new Error(`${holding.ticker} 시세 응답을 찾을 수 없습니다.`);
  return series;
}

function uniqueHoldings(request: PortfolioCompareRequest): PortfolioHoldingInput[] {
  const output = [...request.portfolioA.holdings, ...request.portfolioB.holdings];
  if (request.analysisMode === "virtual") {
    for (const holding of [...output]) {
      if (holding.virtual?.enabled) {
        output.push(...holding.virtual.proxies.map((proxy) => ({ ...proxy })));
      }
    }
  }
  return output;
}

function proxyCompositeAt(
  holding: PortfolioHoldingInput,
  date: string,
  levelsByKey: Map<string, LevelPoint[]>,
  proxyBaseDate: string,
): number | null {
  const proxies = holding.virtual?.proxies ?? [];
  let total = 0;
  for (const proxy of proxies) {
    const levels = levelsByKey.get(portfolioSeriesKey(proxy.market, proxy.ticker)) ?? [];
    const base = asOf(levels, proxyBaseDate);
    const current = asOf(levels, date);
    if (!base || !current || !finitePositive(base.level)) return null;
    total += (proxy.weightPct / 100) * (current.level / base.level);
  }
  return finitePositive(total) ? total : null;
}

function buildAssetPath(args: {
  holding: PortfolioHoldingInput;
  request: PortfolioCompareRequest;
  seriesByKey: Map<string, ResolvedMarketSeries>;
  levelsByKey: Map<string, LevelPoint[]>;
  timeline: string[];
  availabilityStart: string;
}): AssetPathPoint[] {
  const { holding, request, seriesByKey, levelsByKey, timeline, availabilityStart } = args;
  const actualSeries = getSeries(seriesByKey, holding);
  const actualLevels = levelsByKey.get(portfolioSeriesKey(holding.market, holding.ticker)) ?? [];
  const actualStart = actualLevels[0]?.date;
  if (!actualStart) throw new Error(`${holding.ticker}의 실제 시계열이 없습니다.`);

  const useVirtual = request.analysisMode === "virtual" && holding.virtual?.enabled;
  if (!useVirtual) {
    return timeline.flatMap((date) => {
      const current = asOf(actualLevels, date);
      if (!current || date < actualStart || date > actualSeries.dataEnd) return [];
      return [{ date, level: current.level, virtual: false }];
    });
  }

  if (!(availabilityStart < actualStart)) {
    throw new Error(`${holding.ticker}의 Virtual 적용 시작일은 실제 데이터 시작일(${actualStart})보다 빨라야 합니다.`);
  }
  const beforeActual = timeline.filter((date) => date >= availabilityStart && date < actualStart);
  const lastVirtualDate = beforeActual.at(-1);
  const transitionLevel = lastVirtualDate
    ? proxyCompositeAt(holding, lastVirtualDate, levelsByKey, availabilityStart)
    : null;
  if (!finitePositive(transitionLevel)) {
    throw new Error(`${holding.ticker}의 실제 전환 직전 프록시 값을 계산할 수 없습니다.`);
  }
  const actualBase = asOf(actualLevels, actualStart, 0);
  if (!actualBase) throw new Error(`${holding.ticker}의 실제 전환일 가격이 없습니다.`);

  return timeline.flatMap<AssetPathPoint>((date) => {
    if (date < availabilityStart || date > actualSeries.dataEnd) return [];
    if (date < actualStart) {
      const composite = proxyCompositeAt(holding, date, levelsByKey, availabilityStart);
      return finitePositive(composite) ? [{ date, level: composite, virtual: true }] : [];
    }
    const actual = asOf(actualLevels, date);
    if (!actual) return [];
    const level = transitionLevel * (actual.level / actualBase.level);
    return finitePositive(level) ? [{ date, level, virtual: false }] : [];
  });
}

function yearlyReturns(points: PortfolioValuePoint[], commonStart: string, endDate: string): YearlyReturnRow[] {
  const byYear = new Map<number, PortfolioValuePoint[]>();
  for (const point of points) {
    const year = Number(point.date.slice(0, 4));
    const rows = byYear.get(year) ?? [];
    rows.push(point);
    byYear.set(year, rows);
  }
  return Array.from(byYear.entries()).flatMap(([year, rows]) => {
    const first = rows[0];
    const last = rows.at(-1);
    if (!first || !last || !finitePositive(first.value) || rows.length < 2) return [];
    return [{
      year,
      returnPct: round((last.value / first.value - 1) * 100, 4),
      partial: first.date === commonStart || last.date === endDate,
      includesVirtual: rows.some((row) => row.virtual),
    }];
  });
}

function drawdownDetails(points: PortfolioValuePoint[]) {
  if (points.length < 2) return { peakDate: null, troughDate: null, recoveryDate: null, recoveryDays: null };
  let peakValue = points[0].value;
  let peakDate = points[0].date;
  let worst = 0;
  let worstPeakDate: string | null = null;
  let troughDate: string | null = null;
  let troughIndex = -1;
  let worstPeakValue = peakValue;
  points.forEach((point, index) => {
    if (point.value > peakValue) {
      peakValue = point.value;
      peakDate = point.date;
    }
    const drawdown = point.value / peakValue - 1;
    if (drawdown < worst) {
      worst = drawdown;
      worstPeakDate = peakDate;
      worstPeakValue = peakValue;
      troughDate = point.date;
      troughIndex = index;
    }
  });
  let recoveryDate: string | null = null;
  if (troughIndex >= 0) {
    for (let index = troughIndex + 1; index < points.length; index += 1) {
      if (points[index].value >= worstPeakValue) {
        recoveryDate = points[index].date;
        break;
      }
    }
  }
  return {
    peakDate: worstPeakDate,
    troughDate,
    recoveryDate,
    recoveryDays: worstPeakDate && recoveryDate ? daysBetween(worstPeakDate, recoveryDate) : null,
  };
}

function computeMetrics(points: PortfolioValuePoint[], yearly: YearlyReturnRow[]): PortfolioMetrics {
  if (points.length < 2) {
    return {
      totalReturnPct: null, cagrPct: null, mddPct: null, volatilityPct: null,
      sharpe: null, sortino: null, calmar: null, bestYearPct: null, worstYearPct: null,
      positiveYears: 0, negativeYears: 0, drawdown: drawdownDetails(points),
    };
  }
  const first = points[0];
  const last = points.at(-1)!;
  const totalRatio = last.value / first.value;
  const years = Math.max(1 / 365.25, daysBetween(first.date, last.date) / 365.25);
  const returns = points.slice(1).map((point, index) => point.value / points[index].value - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const risk = computeBacktestRiskMetrics(points.map((point) => point.value));
  const yearValues = yearly.map((row) => row.returnPct);
  return {
    totalReturnPct: round((totalRatio - 1) * 100, 2),
    cagrPct: totalRatio > 0 ? round((Math.pow(totalRatio, 1 / years) - 1) * 100, 2) : null,
    mddPct: risk.mddPct == null ? null : round(risk.mddPct, 2),
    volatilityPct: returns.length > 1 ? round(Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100, 2) : null,
    sharpe: risk.sharpe == null ? null : round(risk.sharpe, 2),
    sortino: risk.sortino == null ? null : round(risk.sortino, 2),
    calmar: risk.calmar == null ? null : round(risk.calmar, 2),
    bestYearPct: yearValues.length ? Math.max(...yearValues) : null,
    worstYearPct: yearValues.length ? Math.min(...yearValues) : null,
    positiveYears: yearValues.filter((value) => value > 0).length,
    negativeYears: yearValues.filter((value) => value < 0).length,
    drawdown: drawdownDetails(points),
  };
}

function buildPortfolioResult(args: {
  name: string;
  holdings: PortfolioHoldingInput[];
  request: PortfolioCompareRequest;
  seriesByKey: Map<string, ResolvedMarketSeries>;
  levelsByKey: Map<string, LevelPoint[]>;
  timeline: string[];
  commonStart: string;
  endDate: string;
  availabilityById: Map<string, string>;
}): PortfolioResult {
  const paths = new Map<string, AssetPathPoint[]>();
  const pathMaps = new Map<string, Map<string, AssetPathPoint>>();
  for (const holding of args.holdings) {
    const path = buildAssetPath({
      holding,
      request: args.request,
      seriesByKey: args.seriesByKey,
      levelsByKey: args.levelsByKey,
      timeline: args.timeline,
      availabilityStart: args.availabilityById.get(holding.id)!,
    });
    paths.set(holding.id, path);
    pathMaps.set(holding.id, new Map(path.map((point) => [point.date, point])));
  }

  const bases = new Map<string, number>();
  for (const holding of args.holdings) {
    const base = pathMaps.get(holding.id)?.get(args.commonStart)?.level;
    if (!finitePositive(base)) throw new Error(`${holding.ticker}의 공통 시작일 평가값이 없습니다.`);
    bases.set(holding.id, base);
  }

  const points: PortfolioValuePoint[] = args.timeline.map((date) => {
    let value = 0;
    let virtual = false;
    for (const holding of args.holdings) {
      const point = pathMaps.get(holding.id)?.get(date);
      const base = bases.get(holding.id);
      if (!point || !finitePositive(base)) throw new Error(`${holding.ticker}의 ${date} 평가값을 정렬할 수 없습니다.`);
      value += (holding.weightPct / 100) * (point.level / base);
      virtual ||= point.virtual;
    }
    if (!finitePositive(value)) throw new Error(`${date} 포트폴리오 평가값이 유효하지 않습니다.`);
    return { date, value: round(value, 10), virtual };
  });

  const finalDate = points.at(-1)?.date ?? args.endDate;
  const finalContributions = args.holdings.map((holding) => {
    const point = pathMaps.get(holding.id)?.get(finalDate);
    const base = bases.get(holding.id)!;
    return { holding, contribution: (holding.weightPct / 100) * ((point?.level ?? base) / base) };
  });
  const finalTotal = finalContributions.reduce((sum, row) => sum + row.contribution, 0);
  const holdingResults: PortfolioHoldingResult[] = finalContributions.map(({ holding, contribution }) => {
    const series = getSeries(args.seriesByKey, holding);
    const actualLevels = args.levelsByKey.get(portfolioSeriesKey(holding.market, holding.ticker))!;
    const virtualStart = args.request.analysisMode === "virtual" && holding.virtual?.enabled
      ? args.availabilityById.get(holding.id) ?? null
      : null;
    return {
      id: holding.id,
      requestedTicker: holding.ticker,
      resolvedSymbol: series.resolvedSymbol,
      name: series.name,
      market: holding.market,
      exchange: series.exchange,
      currency: series.currency,
      dataStart: series.dataStart,
      dataEnd: series.dataEnd,
      initialWeightPct: holding.weightPct,
      endingWeightPct: round((contribution / finalTotal) * 100, 2),
      virtualStart,
      actualStart: actualLevels[0].date,
      transitionDate: actualLevels[0].date,
    };
  });
  const yearly = yearlyReturns(points, args.commonStart, args.endDate);
  return { name: args.name, points, holdings: holdingResults, yearly, metrics: computeMetrics(points, yearly) };
}

function monthKeyBack(date: string, months: number): string {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const zeroBased = year * 12 + month - 1 - months;
  return `${Math.floor(zeroBased / 12)}-${String((zeroBased % 12) + 1).padStart(2, "0")}`;
}

function rollingMap(points: PortfolioValuePoint[], months: number): Map<string, number> {
  const monthEnds = new Map<string, PortfolioValuePoint>();
  for (const point of points) monthEnds.set(point.date.slice(0, 7), point);
  const output = new Map<string, number>();
  for (const point of Array.from(monthEnds.values())) {
    const base = monthEnds.get(monthKeyBack(point.date, months));
    if (base && finitePositive(base.value)) output.set(point.date, (point.value / base.value - 1) * 100);
  }
  return output;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function stats(values: number[]) {
  return {
    median: median(values),
    mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
    best: values.length ? Math.max(...values) : null,
    worst: values.length ? Math.min(...values) : null,
  };
}

function rollingSummaries(a: PortfolioValuePoint[], b: PortfolioValuePoint[]): RollingSummary[] {
  return PORTFOLIO_ROLLING_MONTHS.map((months) => {
    const aMap = rollingMap(a, months);
    const bMap = rollingMap(b, months);
    const dates = Array.from(aMap.keys()).filter((date) => bMap.has(date)).sort();
    const aValues = dates.map((date) => aMap.get(date)!);
    const bValues = dates.map((date) => bMap.get(date)!);
    const aStats = stats(aValues);
    const bStats = stats(bValues);
    return {
      months,
      observations: dates.length,
      aMedian: aStats.median == null ? null : round(aStats.median, 2),
      aMean: aStats.mean == null ? null : round(aStats.mean, 2),
      aBest: aStats.best == null ? null : round(aStats.best, 2),
      aWorst: aStats.worst == null ? null : round(aStats.worst, 2),
      bMedian: bStats.median == null ? null : round(bStats.median, 2),
      bMean: bStats.mean == null ? null : round(bStats.mean, 2),
      bBest: bStats.best == null ? null : round(bStats.best, 2),
      bWorst: bStats.worst == null ? null : round(bStats.worst, 2),
      aBeatBPercent: dates.length
        ? round((dates.filter((date) => aMap.get(date)! > bMap.get(date)!).length / dates.length) * 100, 2)
        : null,
    };
  });
}

export function computePortfolioComparison(args: {
  request: PortfolioCompareRequest;
  seriesByKey: Map<string, ResolvedMarketSeries>;
  fxSeries?: ResolvedMarketSeries | null;
}): PortfolioCompareResult {
  const startedAt = performance.now();
  const errors = validatePortfolioCompareRequest(args.request);
  if (errors.length) throw new Error(errors.join("\n"));

  const fxLevels = buildFxLevels(args.fxSeries ?? null);
  const allHoldings = uniqueHoldings(args.request);
  const uniqueKeys = new Set(allHoldings.map((holding) => portfolioSeriesKey(holding.market, holding.ticker)));
  const levelsByKey = new Map<string, LevelPoint[]>();
  let fxRequired = false;
  for (const key of Array.from(uniqueKeys)) {
    const series = args.seriesByKey.get(key);
    if (!series) throw new Error(`${key} 시세가 없습니다.`);
    fxRequired ||= series.currency !== args.request.baseCurrency;
    levelsByKey.set(key, buildConvertedLevels(series, args.request, fxLevels));
  }
  if (fxRequired && fxLevels.length < 2) {
    throw new Error("USD/KRW 실제 환율 시계열을 가져오지 못해 기준통화 환산을 진행할 수 없습니다.");
  }

  const targetHoldings = [...args.request.portfolioA.holdings, ...args.request.portfolioB.holdings];
  const availabilityById = new Map<string, string>();
  for (const holding of targetHoldings) {
    const actual = levelsByKey.get(portfolioSeriesKey(holding.market, holding.ticker))!;
    let start = actual[0].date;
    if (args.request.analysisMode === "virtual" && holding.virtual?.enabled) {
      const proxyStarts = holding.virtual.proxies.map((proxy) => (
        levelsByKey.get(portfolioSeriesKey(proxy.market, proxy.ticker))?.[0]?.date ?? "9999-12-31"
      ));
      start = [holding.virtual.startDate, ...proxyStarts].sort().at(-1)!;
    }
    availabilityById.set(holding.id, start);
  }
  const commonStart = Array.from(availabilityById.values()).sort().at(-1)!;
  const endDate = targetHoldings
    .map((holding) => levelsByKey.get(portfolioSeriesKey(holding.market, holding.ticker))!.at(-1)!.date)
    .sort()[0];
  if (!commonStart || !endDate || commonStart >= endDate) {
    throw new Error(`공통 분석 기간이 없습니다. 시작일 ${commonStart || "없음"}, 종료일 ${endDate || "없음"}`);
  }

  const dateSet = new Set<string>([commonStart, endDate]);
  for (const levels of Array.from(levelsByKey.values())) {
    for (const point of levels) if (point.date >= commonStart && point.date <= endDate) dateSet.add(point.date);
  }
  const timeline = Array.from(dateSet).sort().filter((date) => date >= commonStart && date <= endDate);
  if (timeline.length < 2) throw new Error("공통 분석 기간의 일별 관측치가 부족합니다.");

  const shared = {
    request: args.request,
    seriesByKey: args.seriesByKey,
    levelsByKey,
    timeline,
    commonStart,
    endDate,
    availabilityById,
  };
  const portfolioA = buildPortfolioResult({ ...shared, name: args.request.portfolioA.name, holdings: args.request.portfolioA.holdings });
  const portfolioB = buildPortfolioResult({ ...shared, name: args.request.portfolioB.name, holdings: args.request.portfolioB.holdings });
  const warnings = Array.from(args.seriesByKey.values()).flatMap((series) => series.warnings.map((warning) => `${series.resolvedSymbol}: ${warning}`));
  return {
    portfolioA,
    portfolioB,
    commonStart,
    endDate,
    baseCurrency: args.request.baseCurrency,
    returnMode: args.request.returnMode,
    analysisMode: args.request.analysisMode,
    fxRequired,
    fxSymbol: fxRequired ? args.fxSeries?.resolvedSymbol ?? null : null,
    rolling: rollingSummaries(portfolioA.points, portfolioB.points),
    warnings,
    calculationMs: round(performance.now() - startedAt, 2),
  };
}
