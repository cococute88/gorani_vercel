"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertTriangle, Info, Plus, Trash2 } from "lucide-react";
import TrPrToggle, { type TrPrMode } from "@/components/common/TrPrToggle";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import RollingScatterChart from "@/components/calculator/stock-compare/RollingScatterChart";
import { COMPARE_PERIODS, formatSignedPct } from "@/lib/stock-compare/constants";
import { computeRollingPointsMulti } from "@/lib/stock-compare/metrics";
import { windowCompareSeries } from "@/lib/stock-compare/total-return";
import type { ComparePeriodKey, CompareSeries } from "@/lib/stock-compare/types";
import { PORTFOLIO_ROLLING_MONTHS } from "@/lib/portfolio-compare/engine";
import { analyzePortfolioComparison } from "@/lib/portfolio-compare/service";
import type {
  AnalysisMode,
  BaseCurrency,
  PortfolioCompareRequest,
  PortfolioCompareResult,
  PortfolioHoldingInput,
  PortfolioInput,
  PortfolioMarket,
  PortfolioProxyHolding,
  ReturnMode,
} from "@/lib/portfolio-compare/types";
import { validatePortfolioCompareRequest } from "@/lib/portfolio-compare/validation";

const PerformanceChart = dynamic(() => import("@/components/calculator/stock-compare/PerformanceChart"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-slate-400">차트 로딩 중…</div>,
});

const panel = "min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#2a3336] dark:bg-[#191f20] sm:p-5";
const inputClass = "min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/25 dark:border-[#344044] dark:bg-[#111718] dark:text-white";
const buttonClass = "rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-[#344044]";

function newHolding(id: string, ticker = "SPY"): PortfolioHoldingInput {
  return { id, market: "US", ticker, weightPct: 100 };
}

function initialRequest(): PortfolioCompareRequest {
  return {
    portfolioA: { name: "포트폴리오 A", holdings: [newHolding("a-1", "SPY")] },
    portfolioB: { name: "포트폴리오 B", holdings: [newHolding("b-1", "QQQ")] },
    baseCurrency: "KRW",
    returnMode: "tr",
    analysisMode: "actual",
  };
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function weightTotal(portfolio: PortfolioInput): number {
  return portfolio.holdings.reduce((sum, holding) => sum + (Number.isFinite(holding.weightPct) ? holding.weightPct : 0), 0);
}

function formatValue(value: number | null, suffix = ""): string {
  return value == null || !Number.isFinite(value) ? "데이터 부족" : `${value.toFixed(2)}${suffix}`;
}

function toCompareSeries(result: PortfolioCompareResult): CompareSeries[] {
  const makePoints = (points: PortfolioCompareResult["portfolioA"]["points"]) =>
    points.map((point) => ({ date: point.date, value: Number(((point.value / points[0].value - 1) * 100).toFixed(4)) }));
  const a = makePoints(result.portfolioA.points);
  const b = makePoints(result.portfolioB.points);
  const output: CompareSeries[] = [
    { key: "a", label: result.portfolioA.name, color: "#3b82f6", points: a, overlapAdjusted: false, available: true },
    { key: "b", label: result.portfolioB.name, color: "#ec4899", points: b, overlapAdjusted: false, available: true },
  ];
  if (result.analysisMode === "virtual") {
    const aVirtual = a.filter((_point, index) => result.portfolioA.points[index].virtual);
    const bVirtual = b.filter((_point, index) => result.portfolioB.points[index].virtual);
    if (aVirtual.length) output.push({ key: "aEx", label: `${result.portfolioA.name} Virtual`, color: "#2563eb", points: aVirtual, overlapAdjusted: true, available: true });
    if (bVirtual.length) output.push({ key: "bEx", label: `${result.portfolioB.name} Virtual`, color: "#db2777", points: bVirtual, overlapAdjusted: true, available: true });
  }
  return output;
}

function HoldingEditor(props: {
  label: string;
  portfolio: PortfolioInput;
  mode: AnalysisMode;
  onChange: (portfolio: PortfolioInput) => void;
}) {
  const updateHolding = (id: string, patch: Partial<PortfolioHoldingInput>) => {
    props.onChange({ ...props.portfolio, holdings: props.portfolio.holdings.map((holding) => holding.id === id ? { ...holding, ...patch } : holding) });
  };
  const updateProxy = (holdingId: string, proxyId: string, patch: Partial<PortfolioProxyHolding>) => {
    const holding = props.portfolio.holdings.find((row) => row.id === holdingId);
    if (!holding?.virtual) return;
    updateHolding(holdingId, {
      virtual: { ...holding.virtual, proxies: holding.virtual.proxies.map((proxy) => proxy.id === proxyId ? { ...proxy, ...patch } : proxy) },
    });
  };

  return (
    <fieldset className="min-w-0 rounded-xl border border-slate-200 p-3 dark:border-[#303a3d]">
      <legend className="px-1 text-sm font-extrabold text-slate-900 dark:text-white">{props.label}</legend>
      <label className="mt-1 block text-xs font-semibold text-slate-500">
        포트폴리오 이름
        <input
          className={`${inputClass} mt-1 w-full`}
          value={props.portfolio.name}
          onChange={(event) => props.onChange({ ...props.portfolio, name: event.target.value })}
        />
      </label>

      <div className="mt-3 space-y-3">
        {props.portfolio.holdings.map((holding, index) => (
          <div key={holding.id} className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-[#121819]">
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-[96px_minmax(0,1fr)_110px_40px]">
              <label className="text-xs font-semibold text-slate-500">
                시장
                <select
                  aria-label={`${props.label} ${index + 1} 시장`}
                  className={`${inputClass} mt-1 w-full`}
                  value={holding.market}
                  onChange={(event) => updateHolding(holding.id, { market: event.target.value as PortfolioMarket, ticker: "" })}
                >
                  <option value="US">미국</option>
                  <option value="KR">한국</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-semibold text-slate-500">
                티커·코드
                <input
                  aria-label={`${props.label} ${index + 1} 티커`}
                  className={`${inputClass} mt-1 w-full uppercase`}
                  placeholder={holding.market === "KR" ? "005930 또는 247540.KQ" : "SPY"}
                  value={holding.ticker}
                  onChange={(event) => updateHolding(holding.id, { ticker: event.target.value })}
                />
              </label>
              <label className="text-xs font-semibold text-slate-500">
                비중(%)
                <input
                  aria-label={`${props.label} ${index + 1} 비중`}
                  className={`${inputClass} mt-1 w-full`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={Number.isFinite(holding.weightPct) ? holding.weightPct : ""}
                  onChange={(event) => updateHolding(holding.id, { weightPct: event.target.value === "" ? Number.NaN : Number(event.target.value) })}
                />
              </label>
              <button
                type="button"
                aria-label={`${holding.ticker || index + 1} 삭제`}
                title="종목 삭제"
                disabled={props.portfolio.holdings.length === 1}
                onClick={() => props.onChange({ ...props.portfolio, holdings: props.portfolio.holdings.filter((row) => row.id !== holding.id) })}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/40 disabled:opacity-30 dark:hover:bg-red-950/30"
              >
                <Trash2 size={17} />
              </button>
            </div>

            {props.mode === "virtual" && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-[#2b3436]">
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={holding.virtual?.enabled ?? false}
                    onChange={(event) => updateHolding(holding.id, {
                      virtual: event.target.checked
                        ? holding.virtual ?? { enabled: true, startDate: "2010-01-04", proxies: [{ id: uid("proxy"), market: "US", ticker: "SPY", weightPct: 100 }] }
                        : { ...(holding.virtual ?? { startDate: "", proxies: [] }), enabled: false },
                    })}
                  />
                  이 종목의 상장 전 Virtual Price 보완
                </label>
                {holding.virtual?.enabled && (
                  <div className="mt-3 space-y-2">
                    <label className="block max-w-[220px] text-xs font-semibold text-slate-500">
                      Virtual 적용 시작일
                      <input
                        type="date"
                        className={`${inputClass} mt-1 w-full`}
                        value={holding.virtual.startDate}
                        onChange={(event) => updateHolding(holding.id, { virtual: { ...holding.virtual!, startDate: event.target.value } })}
                      />
                    </label>
                    {holding.virtual.proxies.map((proxy, proxyIndex) => (
                      <div key={proxy.id} className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)_96px_36px] gap-2">
                        <select
                          aria-label={`${holding.ticker} 프록시 ${proxyIndex + 1} 시장`}
                          className={inputClass}
                          value={proxy.market}
                          onChange={(event) => updateProxy(holding.id, proxy.id, { market: event.target.value as PortfolioMarket, ticker: "" })}
                        >
                          <option value="US">미국</option>
                          <option value="KR">한국</option>
                        </select>
                        <input
                          aria-label={`${holding.ticker} 프록시 ${proxyIndex + 1} 티커`}
                          className={`${inputClass} w-full uppercase`}
                          value={proxy.ticker}
                          placeholder="QQQ"
                          onChange={(event) => updateProxy(holding.id, proxy.id, { ticker: event.target.value })}
                        />
                        <input
                          aria-label={`${holding.ticker} 프록시 ${proxyIndex + 1} 비중`}
                          className={`${inputClass} w-full`}
                          type="number"
                          min="0.01"
                          value={Number.isFinite(proxy.weightPct) ? proxy.weightPct : ""}
                          onChange={(event) => updateProxy(holding.id, proxy.id, { weightPct: event.target.value === "" ? Number.NaN : Number(event.target.value) })}
                        />
                        <button
                          type="button"
                          aria-label="프록시 삭제"
                          disabled={holding.virtual!.proxies.length === 1}
                          onClick={() => updateHolding(holding.id, { virtual: { ...holding.virtual!, proxies: holding.virtual!.proxies.filter((row) => row.id !== proxy.id) } })}
                          className="inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={holding.virtual.proxies.length >= 10}
                        onClick={() => updateHolding(holding.id, {
                          virtual: { ...holding.virtual!, proxies: [...holding.virtual!.proxies, { id: uid("proxy"), market: "US", ticker: "", weightPct: 0 }] },
                        })}
                        className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-40"
                      >
                        + 프록시 추가
                      </button>
                      <span className="text-xs font-bold text-slate-500">
                        프록시 합계 {holding.virtual.proxies.reduce((sum, proxy) => sum + (Number.isFinite(proxy.weightPct) ? proxy.weightPct : 0), 0).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={props.portfolio.holdings.length >= 10}
          onClick={() => props.onChange({ ...props.portfolio, holdings: [...props.portfolio.holdings, newHolding(uid(props.label === "포트폴리오 A" ? "a" : "b"), "")] })}
          className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline disabled:opacity-40"
        >
          <Plus size={14} /> 종목 추가
        </button>
        <span className={`text-sm font-extrabold ${Math.abs(weightTotal(props.portfolio) - 100) < 1e-8 ? "text-emerald-600" : "text-red-600"}`}>
          비중 합계 {weightTotal(props.portfolio).toFixed(2)}%
        </span>
      </div>
    </fieldset>
  );
}

export default function PortfolioCompareCalculator() {
  const dark = useResolvedTheme() === "dark";
  const [request, setRequest] = useState<PortfolioCompareRequest>(initialRequest);
  const [result, setResult] = useState<PortfolioCompareResult | null>(null);
  const [period, setPeriod] = useState<ComparePeriodKey>("max");
  const [rollingMonths, setRollingMonths] = useState<number>(12);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const validation = useMemo(() => validatePortfolioCompareRequest(request), [request]);

  const maxSeries = useMemo(() => result ? toCompareSeries(result) : [], [result]);
  const periodDays = COMPARE_PERIODS.find((item) => item.key === period)?.days ?? Infinity;
  const windowSeries = useMemo(() => windowCompareSeries(maxSeries, periodDays), [maxSeries, periodDays]);
  const rollingByWindow = useMemo(
    () => computeRollingPointsMulti(maxSeries.filter((series) => series.key === "a" || series.key === "b"), [...PORTFOLIO_ROLLING_MONTHS]),
    [maxSeries],
  );
  const activeRolling = result?.rolling.find((row) => row.months === rollingMonths);

  const runAnalysis = async () => {
    if (validation.length) {
      setError(validation.join("\n"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResult(await analyzePortfolioComparison(request));
      setHidden({});
    } catch (cause) {
      setResult(null);
      setError(cause instanceof Error ? cause.message : "포트폴리오 분석에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const updateRequest = <K extends keyof PortfolioCompareRequest>(key: K, value: PortfolioCompareRequest[K]) =>
    setRequest((previous) => ({ ...previous, [key]: value }));

  return (
    <div className="min-w-0 space-y-5">
      <section className={panel}>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">포트폴리오 성과 비교</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          공통 시작일에 입력 비중으로 한 번 매수한 뒤 리밸런싱 없이 보유한 포트폴리오 A와 B를 비교합니다.
        </p>
        <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <HoldingEditor label="포트폴리오 A" portfolio={request.portfolioA} mode={request.analysisMode} onChange={(portfolioA) => updateRequest("portfolioA", portfolioA)} />
          <HoldingEditor label="포트폴리오 B" portfolio={request.portfolioB} mode={request.analysisMode} onChange={(portfolioB) => updateRequest("portfolioB", portfolioB)} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-[#121819] md:grid-cols-3">
          <label className="text-xs font-bold text-slate-500">
            기준통화
            <select className={`${inputClass} mt-1 w-full`} value={request.baseCurrency} onChange={(event) => updateRequest("baseCurrency", event.target.value as BaseCurrency)}>
              <option value="KRW">KRW</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-500">
            분석 모드
            <select className={`${inputClass} mt-1 w-full`} value={request.analysisMode} onChange={(event) => updateRequest("analysisMode", event.target.value as AnalysisMode)}>
              <option value="actual">실제 상장 이후</option>
              <option value="virtual">Virtual Price 보완</option>
            </select>
          </label>
          <div className="text-xs font-bold text-slate-500">
            수익률 기준
            <div className="mt-1"><TrPrToggle mode={request.returnMode as TrPrMode} onChange={(mode) => updateRequest("returnMode", mode as ReturnMode)} disabled={loading} /></div>
          </div>
        </div>

        {validation.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            {validation[0]}{validation.length > 1 ? ` 외 ${validation.length - 1}건` : ""}
          </div>
        )}
        {error && (
          <div role="alert" className="mt-3 whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
            <AlertTriangle className="mr-2 inline" size={16} />{error}
          </div>
        )}
        <button
          type="button"
          disabled={loading || validation.length > 0}
          onClick={() => void runAnalysis()}
          className="mt-4 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:focus:ring-offset-[#191f20]"
        >
          {loading ? "실제 시세 조회 및 계산 중…" : "포트폴리오 분석 실행"}
        </button>
      </section>

      {result && (
        <>
          <section className={panel}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">누적 성과</h3>
                <p className="mt-1 text-xs text-slate-500">{result.commonStart} ~ {result.endDate} · {result.returnMode.toUpperCase()} · {result.baseCurrency}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                {COMPARE_PERIODS.map((item) => (
                  <button key={item.key} type="button" onClick={() => setPeriod(item.key)} className={`${buttonClass} px-2.5 py-1.5 text-xs ${period === item.key ? "border-blue-600 bg-blue-600 text-white" : ""}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {maxSeries.filter((series) => series.key === "a" || series.key === "b").map((series) => (
                <button
                  key={series.key}
                  type="button"
                  onClick={() => setHidden((previous) => {
                    const nextHidden = !previous[series.key];
                    const virtualKey = series.key === "a" ? "aEx" : "bEx";
                    return { ...previous, [series.key]: nextHidden, [virtualKey]: nextHidden };
                  })}
                  className={`${buttonClass} px-2.5 py-1.5 text-xs ${hidden[series.key] ? "opacity-45" : ""}`}
                >
                  <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: series.color }} />{series.label}
                </button>
              ))}
            </div>
            <div className="mt-3 h-[340px] min-w-0 sm:h-[420px]">
              <PerformanceChart series={maxSeries} dark={dark} hidden={hidden} viewDays={periodDays} />
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {windowSeries.filter((series) => series.key === "a" || series.key === "b").map((series) => (
                <div key={series.key} className="rounded-xl bg-slate-50 p-3 dark:bg-[#121819]">
                  <div className="text-xs font-bold text-slate-500">{series.label} 선택기간 수익률</div>
                  <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{formatSignedPct(series.points.at(-1)?.value)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className={panel}>
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">성과 및 위험지표 (MAX)</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="text-slate-500"><tr><th className="p-2">포트폴리오</th><th className="p-2">누적수익률</th><th className="p-2">CAGR</th><th className="p-2">MDD</th><th className="p-2">변동성</th><th className="p-2">Sharpe</th><th className="p-2">Sortino</th><th className="p-2">Calmar</th><th className="p-2">최고/최악 연도</th><th className="p-2">낙폭·회복</th></tr></thead>
                <tbody>
                  {([result.portfolioA, result.portfolioB] as const).map((portfolio) => (
                    <tr key={portfolio.name} className="border-t border-slate-200 dark:border-[#2b3436]">
                      <th className="p-2 font-extrabold">{portfolio.name}</th>
                      <td className="p-2">{formatValue(portfolio.metrics.totalReturnPct, "%")}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.cagrPct, "%")}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.mddPct, "%")}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.volatilityPct, "%")}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.sharpe)}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.sortino)}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.calmar)}</td>
                      <td className="p-2">{formatValue(portfolio.metrics.bestYearPct, "%")} / {formatValue(portfolio.metrics.worstYearPct, "%")}<br /><span className="text-slate-500">+{portfolio.metrics.positiveYears} · −{portfolio.metrics.negativeYears}</span></td>
                      <td className="p-2">{portfolio.metrics.drawdown.peakDate ?? "데이터 부족"} → {portfolio.metrics.drawdown.troughDate ?? "데이터 부족"}<br /><span className="text-slate-500">회복 {portfolio.metrics.drawdown.recoveryDate ?? "미회복"}{portfolio.metrics.drawdown.recoveryDays != null ? ` (${portfolio.metrics.drawdown.recoveryDays}일)` : ""}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={panel}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">Rolling 수익률</h3><p className="mt-1 text-xs text-slate-500">이미 생성된 Buy & Hold 가치 시계열의 월말 기준 측정입니다.</p></div>
              <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
                {PORTFOLIO_ROLLING_MONTHS.map((months) => (
                  <button key={months} type="button" onClick={() => setRollingMonths(months)} className={`${buttonClass} shrink-0 px-2.5 py-1.5 text-xs ${rollingMonths === months ? "border-blue-600 bg-blue-600 text-white" : ""}`}>
                    {months / 12}Y
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 h-[300px] min-w-0"><RollingScatterChart points={rollingByWindow[rollingMonths] ?? []} series={maxSeries.filter((series) => series.key === "a" || series.key === "b")} hidden={hidden} dark={dark} /></div>
            {activeRolling && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>관측치</b><br />{activeRolling.observations}</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>A 중앙/평균</b><br />{formatValue(activeRolling.aMedian, "%")} / {formatValue(activeRolling.aMean, "%")}</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>A 최고/최저</b><br />{formatValue(activeRolling.aBest, "%")} / {formatValue(activeRolling.aWorst, "%")}</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>B 중앙/평균</b><br />{formatValue(activeRolling.bMedian, "%")} / {formatValue(activeRolling.bMean, "%")}</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>B 최고/최저</b><br />{formatValue(activeRolling.bBest, "%")} / {formatValue(activeRolling.bWorst, "%")}</div>
                <div className="rounded-lg bg-slate-50 p-2 dark:bg-[#121819]"><b>A 우위 비율</b><br />{formatValue(activeRolling.aBeatBPercent, "%")}</div>
              </div>
            )}
          </section>

          <section className={panel}>
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">최초 비중 → 종료일 평가 비중</h3>
            <div className="mt-3 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
              {([result.portfolioA, result.portfolioB] as const).map((portfolio) => (
                <div key={portfolio.name} className="min-w-0 rounded-xl bg-slate-50 p-3 dark:bg-[#121819]">
                  <h4 className="text-sm font-extrabold">{portfolio.name}</h4>
                  <div className="mt-2 space-y-2">
                    {portfolio.holdings.map((holding) => (
                      <div key={holding.id} className="min-w-0 text-xs">
                        <div className="flex min-w-0 justify-between gap-3"><span className="truncate font-bold">{holding.name} ({holding.resolvedSymbol})</span><span className="shrink-0">{holding.initialWeightPct.toFixed(2)}% → {holding.endingWeightPct.toFixed(2)}%</span></div>
                        <div className="mt-0.5 break-words text-[11px] text-slate-500">입력 {holding.requestedTicker} → 해결 {holding.resolvedSymbol} · {holding.market === "KR" ? "한국" : "미국"} · {holding.exchange || "거래소 미상"} · {holding.currency} · 실제 {holding.dataStart}~{holding.dataEnd}{holding.virtualStart ? ` · Virtual ${holding.virtualStart}~${holding.actualStart} 직전 · 실제 전환 ${holding.transitionDate}` : ""}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className={panel}>
            <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-white">연도별 수익률</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="text-left text-slate-500"><tr><th className="p-2">연도</th><th className="p-2">{result.portfolioA.name}</th><th className="p-2">{result.portfolioB.name}</th><th className="p-2">차이</th><th className="p-2">구분</th></tr></thead>
                <tbody>
                  {Array.from(new Set([...result.portfolioA.yearly.map((row) => row.year), ...result.portfolioB.yearly.map((row) => row.year)])).sort().map((year) => {
                    const a = result.portfolioA.yearly.find((row) => row.year === year);
                    const b = result.portfolioB.yearly.find((row) => row.year === year);
                    return <tr key={year} className="border-t border-slate-200 dark:border-[#2b3436]"><td className="p-2 font-bold">{year}</td><td className="p-2">{formatSignedPct(a?.returnPct)}</td><td className="p-2">{formatSignedPct(b?.returnPct)}</td><td className="p-2">{a && b ? formatSignedPct(a.returnPct - b.returnPct) : "데이터 부족"}</td><td className="p-2 text-slate-500">{a?.partial || b?.partial ? "부분 연도 " : ""}{a?.includesVirtual || b?.includesVirtual ? "· Virtual 포함" : "· 실제"}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${panel} text-xs leading-relaxed text-slate-600 dark:text-slate-300`}>
            <div className="flex gap-2"><Info className="mt-0.5 shrink-0 text-blue-500" size={16} /><div><b>최초 입력 비중으로 매수 후 리밸런싱 없이 보유 · 거래비용 및 세금 미반영</b><br />{result.returnMode.toUpperCase()} · {result.baseCurrency} · {result.analysisMode === "actual" ? "실제 상장 이후" : "Virtual 보완"} · 공통 시작일 {result.commonStart} · 종료일 {result.endDate} · 데이터 출처 Yahoo Finance 일별 {result.returnMode === "tr" ? "조정종가" : "종가"}{result.fxRequired ? ` · 환율 ${result.fxSymbol}` : ""}<br />Virtual 구간은 사용자가 지정한 프록시의 과거 수익률을 연결한 추정치이며 실제 거래 이력이 아닙니다. 실제 데이터 시작 후에는 실제 종목 수익률만 사용합니다.<br />계산 {result.calculationMs.toFixed(2)}ms · 기간/Zoom/Rolling 전환은 추가 API 요청 없이 메모리 데이터만 사용합니다.</div></div>
          </section>
        </>
      )}
    </div>
  );
}
