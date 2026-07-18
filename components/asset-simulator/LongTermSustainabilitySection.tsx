"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info, RefreshCw } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { buildRetirementBootstrapInput } from "@/lib/retirement-bootstrap-adapter";
import { PRODUCTION_MARKET_PATTERN_DATASET_VERSION } from "@/lib/retirement-bootstrap-config";
import {
  DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH,
  DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS,
  type RetirementBootstrapInput,
  type RetirementBootstrapPeriodResult,
} from "@/lib/retirement-bootstrap-types";
import { classifyRetirementBootstrapInputError } from "@/lib/retirement-bootstrap-ui";
import type {
  AppliedPortfolioAssumptionsV1,
  SimulatorInputs,
} from "@/lib/asset-simulator-types";
import type { RetirementBootstrapWorkerError } from "@/lib/retirement-bootstrap-worker-protocol";
import { useRetirementBootstrapAnalysis } from "./useRetirementBootstrapAnalysis";

type Props = {
  active: boolean;
  hydrated: boolean;
  inputs: SimulatorInputs;
  portfolioAssumptions: AppliedPortfolioAssumptionsV1 | null;
  targetMonthlyExpenseReal: number | null;
};

type ChartMetricKey = "successRatePct" | "principal50Pct" | "principal25Pct";
type ChartDatum = {
  periodYears: number;
  periodLabel: string;
  simulationCount: number;
  successRatePct: number;
  principal50Pct: number;
  principal25Pct: number;
};

type FocusedPoint = {
  periodYears: number;
  metricLabel: string;
  value: number;
  simulationCount: number;
};

const METRICS: Array<{
  key: ChartMetricKey;
  label: string;
  color: string;
  dash?: string;
  shape: "circle" | "square" | "diamond";
}> = [
  { key: "successRatePct", label: "지속 성공률", color: "#2563eb", shape: "circle" },
  { key: "principal50Pct", label: "실질 원금 50% 이하", color: "#d97706", dash: "7 4", shape: "diamond" },
  { key: "principal25Pct", label: "실질 원금 25% 이하", color: "#dc2626", dash: "2 4", shape: "square" },
];

const ERROR_COPY: Record<RetirementBootstrapWorkerError["code"], string> = {
  unsupported_etf: "현재 장기 분석에서 지원하지 않는 ETF가 포함되어 있습니다. SPY·QQQ·SCHD·JEPQ의 승인된 자산군 proxy 매핑을 확인해 주세요.",
  production_dataset_load_failed: "production 시장 패턴 데이터를 불러오지 못했습니다.",
  dataset_integrity_failed: "production 시장 패턴 데이터의 무결성을 확인하지 못했습니다. 가짜 결과는 표시하지 않습니다.",
  worker_initialization_failed: "백그라운드 계산을 시작하지 못했습니다.",
  calculation_failed: "10,000개 장기 경로를 계산하는 중 오류가 발생했습니다.",
  invalid_user_input: "장기 분석에 필요한 사용자 입력을 확인해 주세요.",
};

function formatProbability(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatChartProbability(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDiagnosticAmount(value: number): string {
  return `${new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value)}만원`;
}

function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8, placement: "bottom" as "top" | "bottom" });
  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportMargin = 8;
    const gap = 8;
    const fitsAbove = triggerRect.top >= tooltipRect.height + gap + viewportMargin;
    const placement = fitsAbove ? "top" : "bottom";
    const unclampedLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - viewportMargin,
      Math.max(viewportMargin, unclampedLeft),
    );
    const top = placement === "top"
      ? triggerRect.top - tooltipRect.height - gap
      : triggerRect.bottom + gap;
    setPosition({ left, top, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePosition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updatePosition]);

  return (
    <span className="inline-flex align-middle">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-describedby={open ? tooltipId : undefined}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            event.currentTarget.blur();
          }
        }}
        className="ml-1 inline-flex rounded-full text-slate-400 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:hover:text-slate-200"
      >
        <Info aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          data-tooltip-placement={position.placement}
          className="pointer-events-none fixed z-[1000] w-64 max-w-[calc(100vw-1rem)] rounded-xl bg-slate-950 px-3 py-2 text-left text-[11px] font-normal leading-5 text-white shadow-xl"
          style={{ left: position.left, top: position.top }}
        >
          {children}
        </span>,
        document.body,
      ) : null}
    </span>
  );
}

function ProbabilityTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; payload?: ChartDatum }>;
}) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload;
  if (!datum) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[12px] shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-950/95">
      <p className="font-bold text-slate-900 dark:text-white">{datum.periodYears}년 checkpoint</p>
      <div className="mt-1 space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="text-slate-600 dark:text-slate-300">
            {item.name}: <strong>{formatChartProbability(Number(item.value ?? 0))}</strong>
          </p>
        ))}
      </div>
      <p className="mt-1 text-slate-500">시뮬레이션 {datum.simulationCount.toLocaleString("ko-KR")}회</p>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: RetirementBootstrapWorkerError;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-950 dark:bg-rose-950/20">
      <p className="text-[13px] font-bold text-rose-800 dark:text-rose-300">장기 지속 가능성 분석을 표시할 수 없습니다.</p>
      <p className="mt-1 text-[12px] leading-5 text-rose-700 dark:text-rose-400">{ERROR_COPY[error.code]}</p>
      <p className="mt-1 break-words text-[11px] text-rose-600/80 dark:text-rose-400/80">{error.message}</p>
      {error.retryable ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-rose-700 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500 dark:border-rose-800 dark:bg-transparent dark:text-rose-300"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" /> 재시도
        </button>
      ) : null}
    </div>
  );
}

export default function LongTermSustainabilitySection({
  active,
  hydrated,
  inputs,
  portfolioAssumptions,
  targetMonthlyExpenseReal,
}: Props) {
  const [retryToken, setRetryToken] = useState(0);
  const [focusedPoint, setFocusedPoint] = useState<FocusedPoint | null>(null);
  const [uiRenderMs, setUiRenderMs] = useState<number | null>(null);
  const prepared = useMemo<{
    input: RetirementBootstrapInput | null;
    inputError: RetirementBootstrapWorkerError | null;
  }>(() => {
    if (!hydrated || !portfolioAssumptions || targetMonthlyExpenseReal === null) {
      return { input: null, inputError: null };
    }
    try {
      return {
        input: buildRetirementBootstrapInput({ inputs, portfolioAssumptions, targetMonthlyExpenseReal }),
        inputError: null,
      };
    } catch (error) {
      return { input: null, inputError: classifyRetirementBootstrapInputError(error) };
    }
  }, [hydrated, inputs, portfolioAssumptions, targetMonthlyExpenseReal]);
  const analysis = useRetirementBootstrapAnalysis(prepared.input, active, retryToken);

  useLayoutEffect(() => {
    if (!analysis.result || !analysis.timing) {
      setUiRenderMs(null);
      return;
    }
    setUiRenderMs(Math.max(0, performance.now() - analysis.timing.resultReceivedAtPerfMs));
  }, [analysis.result, analysis.timing]);

  const periods = useMemo(() => analysis.result?.periods ?? [], [analysis.result]);
  const summaryPeriod = periods.find((period) => period.periodYears === 60) ?? periods.at(-1) ?? null;
  const summaryFailureDiagnostics = analysis.result?.failureDiagnostics.periods.find(
    (period) => period.periodYears === summaryPeriod?.periodYears,
  ) ?? null;
  const firstWithdrawalCashflow = analysis.result?.failureDiagnostics.firstWithdrawalCashflow ?? null;
  const summaryFirstFailure = summaryFailureDiagnostics?.firstFailureYears[0] ?? null;
  const chartData = useMemo<ChartDatum[]>(() => periods.map((period) => ({
    periodYears: period.periodYears,
    periodLabel: `${period.periodYears}년`,
    simulationCount: period.simulationCount,
    successRatePct: period.successRate * 100,
    principal50Pct: period.reachedRealPrincipal50PctProbability * 100,
    principal25Pct: period.reachedRealPrincipal25PctProbability * 100,
  })), [periods]);

  const renderDot = (
    metric: (typeof METRICS)[number],
    props: { cx?: number; cy?: number; payload?: ChartDatum },
  ) => {
    const { cx, cy, payload } = props;
    if (typeof cx !== "number" || typeof cy !== "number" || !payload) {
      return <g key={`${metric.key}-empty`} aria-hidden="true" />;
    }
    const value = payload[metric.key];
    const focused: FocusedPoint = {
      periodYears: payload.periodYears,
      metricLabel: metric.label,
      value,
      simulationCount: payload.simulationCount,
    };
    return (
      <g
        key={`${metric.key}-${payload.periodYears}`}
        tabIndex={0}
        role="img"
        aria-label={`${payload.periodYears}년 ${metric.label} ${formatChartProbability(value)}, 시뮬레이션 ${payload.simulationCount.toLocaleString("ko-KR")}회`}
        onFocus={() => setFocusedPoint(focused)}
        onBlur={() => setFocusedPoint(null)}
        onMouseEnter={() => setFocusedPoint(focused)}
        onMouseLeave={() => setFocusedPoint(null)}
        className="outline-none focus-visible:drop-shadow-[0_0_4px_rgba(37,99,235,0.9)]"
      >
        {metric.shape === "circle" ? <circle cx={cx} cy={cy} r={5} fill={metric.color} stroke="white" strokeWidth={2} /> : null}
        {metric.shape === "square" ? <rect x={cx - 5} y={cy - 5} width={10} height={10} rx={1} fill={metric.color} stroke="white" strokeWidth={2} /> : null}
        {metric.shape === "diamond" ? <path d={`M ${cx} ${cy - 6} L ${cx + 6} ${cy} L ${cx} ${cy + 6} L ${cx - 6} ${cy} Z`} fill={metric.color} stroke="white" strokeWidth={2} /> : null}
      </g>
    );
  };

  const resultContent = analysis.result && summaryPeriod ? (
    <div className={analysis.refreshing ? "pointer-events-none opacity-35" : ""} aria-busy={analysis.refreshing}>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <p className="rounded-xl bg-blue-50 p-3 text-[12.5px] leading-5 text-blue-950 dark:bg-blue-950/30 dark:text-blue-100">
          현재 가정에서 <strong>{summaryPeriod.periodYears}년 지속 성공률은 {formatProbability(summaryPeriod.successRate)}</strong>입니다.
        </p>
        <p className="rounded-xl bg-amber-50 p-3 text-[12.5px] leading-5 text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          {summaryPeriod.periodYears}년 중 실질 자산이 최초 원금의 <strong>50% 이하로 내려갈 확률은 {formatProbability(summaryPeriod.reachedRealPrincipal50PctProbability)}</strong>입니다.
        </p>
        <p className="rounded-xl bg-rose-50 p-3 text-[12.5px] leading-5 text-rose-950 dark:bg-rose-950/30 dark:text-rose-100">
          <strong>25% 이하로 내려갈 확률은 {formatProbability(summaryPeriod.reachedRealPrincipal25PctProbability)}</strong>입니다.
        </p>
      </div>

      {summaryPeriod.successCount === 0 && summaryFailureDiagnostics ? (
        <div role="note" className="mt-3 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2.5 text-[11.5px] leading-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-100">
          <p className="font-semibold">0.0%는 자산이 모두 고갈됐다는 뜻이 아닙니다.</p>
          <p className="mt-0.5">
            {summaryFailureDiagnostics.withdrawalShortfallOnlyCount + summaryFailureDiagnostics.withdrawalShortfallAndDepletionCount
              === summaryPeriod.simulationCount
              ? `${summaryPeriod.simulationCount.toLocaleString("ko-KR")}개 경로 모두 최소 한 해의 세후 생활비 공급이 필요액보다 부족했습니다.`
              : `${summaryPeriod.simulationCount.toLocaleString("ko-KR")}개 경로의 실패에는 생활비 공급 부족과 자산 고갈 판정이 각각 반영됩니다.`}
            {summaryFirstFailure ? ` 가장 이른 실패는 ${summaryFirstFailure.calendarYear}년(${summaryFirstFailure.count.toLocaleString("ko-KR")}개 경로)입니다.` : ""}
          </p>
          {firstWithdrawalCashflow ? (
            <p className="mt-0.5 text-blue-800 dark:text-blue-200">
              첫 인출연도 {firstWithdrawalCashflow.calendarYear}년 경로 평균: 필요 세후 생활비 {formatDiagnosticAmount(firstWithdrawalCashflow.averageRequiredWithdrawalNominal)} · 세후 공급 {formatDiagnosticAmount(firstWithdrawalCashflow.averageSuppliedWithdrawalNet)} · 부족 경로 {firstWithdrawalCashflow.shortfallCount.toLocaleString("ko-KR")}/{firstWithdrawalCashflow.observedPathCount.toLocaleString("ko-KR")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(700px,1.15fr)_minmax(480px,0.85fr)]">
        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">기간별 결과</h3>
          <div className="mt-2 max-w-full overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-[700px] w-full border-collapse text-left text-[12px]">
              <caption className="sr-only">30년부터 70년까지 장기 지속 성공률과 실질 원금 임계값 도달 확률</caption>
              <thead className="bg-slate-50 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <tr>
                  <th scope="col" className="px-3 py-3 font-semibold">기간</th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    지속 성공률
                    <InfoTip label="지속 성공률 설명">해당 기간 동안 인출 시작 이후 매년 필요한 세후 생활비를 모두 충족하고 자산이 고갈되지 않은 경로의 비율입니다. 자산이 많이 남아 있어도 특정 연도의 생활비를 충족하지 못하면 실패로 계산될 수 있습니다.</InfoTip>
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    실질 원금 50% 이하 확률
                    <InfoTip label="실질 원금 50% 이하 확률 설명">기간 중 한 번이라도 시작 구매력 기준 최초 실질 원금의 50% 이하로 내려간 경로 비율입니다. 이후 회복했어도 포함됩니다.</InfoTip>
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold">
                    실질 원금 25% 이하 확률
                    <InfoTip label="실질 원금 25% 이하 확률 설명">기간 중 한 번이라도 시작 구매력 기준 최초 실질 원금의 25% 이하로 내려간 경로 비율입니다. 이후 회복했어도 포함됩니다.</InfoTip>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {periods.map((period: RetirementBootstrapPeriodResult) => (
                  <tr key={period.periodYears} className="bg-white dark:bg-[#171d1e]">
                    <th scope="row" className="whitespace-nowrap px-3 py-3 font-bold text-slate-900 dark:text-white">{period.periodYears}년</th>
                    <td className="px-3 py-3 font-semibold text-blue-700 dark:text-blue-300">● {formatProbability(period.successRate)}</td>
                    <td className="px-3 py-3 font-semibold text-amber-700 dark:text-amber-300">◆ {formatProbability(period.reachedRealPrincipal50PctProbability)}</td>
                    <td className="px-3 py-3 font-semibold text-rose-700 dark:text-rose-300">■ {formatProbability(period.reachedRealPrincipal25PctProbability)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            지속 성공률과 실질 원금 임계확률은 서로 반대 개념이 아닙니다. 자산이 원금의 50%보다 많이 남아 있어도 특정 연도의 세후 생활비를 충족하지 못하면 지속 성공에서는 실패할 수 있습니다. 세 지표는 합계가 100%가 되도록 조정하지 않습니다.
          </p>
        </div>

        <div className="min-w-0">
          <h3 className="text-[13px] font-bold text-slate-800 dark:text-slate-200">5개 checkpoint 비교</h3>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">선은 계산된 다섯 점을 읽기 쉽게 연결한 것이며 연속 예측 함수가 아닙니다.</p>
          <div className="relative mt-2 max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-[#171d1e]">
            {focusedPoint ? (
              <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] shadow-lg dark:border-slate-700 dark:bg-slate-950/95">
                <p className="font-bold">{focusedPoint.periodYears}년 · {focusedPoint.metricLabel}</p>
                <p>{formatChartProbability(focusedPoint.value)} · {focusedPoint.simulationCount.toLocaleString("ko-KR")}회</p>
              </div>
            ) : null}
            <div className="h-[330px] min-w-[520px]" aria-label="장기 지속 가능성 checkpoint 점 그래프">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 20, right: 18, bottom: 10, left: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.45} />
                  <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} width={42} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 11 }} />
                  <Tooltip content={<ProbabilityTooltip />} />
                  <Legend verticalAlign="bottom" iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  {METRICS.map((metric) => (
                    <Line
                      key={metric.key}
                      type="linear"
                      dataKey={metric.key}
                      name={metric.label}
                      stroke={metric.color}
                      strokeWidth={2}
                      strokeDasharray={metric.dash}
                      dot={(props) => renderDot(metric, props)}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/30">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-slate-700 dark:text-slate-300">분석 방법과 데이터</summary>
        <div className="mt-2 grid gap-x-5 gap-y-1 text-[11px] leading-5 text-slate-600 dark:text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
          <p>방식: {DEFAULT_RETIREMENT_BOOTSTRAP_BLOCK_LENGTH}년 블록 부트스트랩</p>
          <p>반복: {DEFAULT_RETIREMENT_BOOTSTRAP_ITERATIONS.toLocaleString("ko-KR")}회</p>
          <p>데이터 기간: {analysis.result.dataPeriod.startYear}~{analysis.result.dataPeriod.endYear}</p>
          <p>시장 패턴: 자산군 proxy</p>
          <p>실질금액 기준: 시작 시점 구매력</p>
          <p className="break-all">datasetVersion: {analysis.result.datasetVersion}</p>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-500">
          사용자 입력 CAGR을 장기 중심값으로 두고, 역사 데이터에서는 변동·위기·회복의 순서를 가져옵니다. 5년 블록을 복원추출하므로 같은 블록이 반복될 수 있습니다. QQQ·SCHD·JEPQ에 개별 ETF의 55년 실제 역사를 적용한 결과가 아닙니다.
        </p>
        <p className="mt-1 text-[11px] leading-5 text-slate-500">
          Seed는 datasetVersion과 결과에 영향을 주는 정규화 사용자 입력에서 결정적으로 생성됩니다(현재 seed {analysis.seed}). 동일 입력·datasetVersion에서는 새로고침이나 재렌더링으로 결과가 흔들리지 않습니다.
        </p>
        {prepared.input ? (
          <details className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <summary className="cursor-pointer text-[11px] font-semibold text-slate-600 dark:text-slate-400">현재 계산 입력·첫 인출연도 진단</summary>
            <div className="mt-2 grid gap-x-5 gap-y-1 text-[10.5px] leading-5 text-slate-500 sm:grid-cols-2 lg:grid-cols-3">
              <p>초기 ISA: {formatDiagnosticAmount(prepared.input.initialIsa)}</p>
              <p>초기 연금: {formatDiagnosticAmount(prepared.input.initialPension)}</p>
              <p>초기 위탁: {formatDiagnosticAmount(prepared.input.initialBrokerage)}</p>
              <p>총 초기자산: {formatDiagnosticAmount(prepared.input.initialIsa + prepared.input.initialPension + prepared.input.initialBrokerage)}</p>
              <p>목표 월생활비: {formatDiagnosticAmount(prepared.input.annualRequiredWithdrawalReal / 12)}</p>
              <p>연간 필수 세후 생활비: {formatDiagnosticAmount(prepared.input.annualRequiredWithdrawalReal)}</p>
              <p>인출률/증가율: {prepared.input.withdrawalRatePct}% / {prepared.input.withdrawalGrowthRatePct}%</p>
              <p>인출 시작: {prepared.input.startYear + Math.max(1, prepared.input.withdrawalDelayYears)}년</p>
              <p>기대 인플레이션: {prepared.input.expectedInflationPct}%</p>
            </div>
            <p className="mt-1 text-[10.5px] leading-5 text-slate-500">
              절세계좌: {prepared.input.taxSavingHoldings.map((holding) => `${holding.ticker} ${holding.weightPct}% · CAGR ${holding.expectedTotalReturnCagrPct}%`).join(" / ") || "없음"}
            </p>
            <p className="mt-1 text-[10.5px] leading-5 text-slate-500">
              위탁계좌: {prepared.input.brokerageHoldings.map((holding) => `${holding.ticker} ${holding.weightPct}% · 가격 ${holding.expectedPriceCagrPct}% · 배당 ${holding.initialDividendYieldPct}% · 배당성장 ${holding.expectedDividendGrowthPct}%`).join(" / ") || "없음"}
            </p>
            {firstWithdrawalCashflow ? (
              <p className="mt-1 text-[10.5px] leading-5 text-slate-500">
                첫 인출연도 경로 평균: ISA 세전/세후 {formatDiagnosticAmount(firstWithdrawalCashflow.averageGrossIsaWithdrawal)} / {formatDiagnosticAmount(firstWithdrawalCashflow.averageNetIsaWithdrawal)} · 연금 세전/세후 {formatDiagnosticAmount(firstWithdrawalCashflow.averageGrossPensionWithdrawal)} / {formatDiagnosticAmount(firstWithdrawalCashflow.averageNetPensionWithdrawal)} · 위탁 배당 세전/세후 {formatDiagnosticAmount(firstWithdrawalCashflow.averageGrossBrokerageDividend)} / {formatDiagnosticAmount(firstWithdrawalCashflow.averageNetBrokerageDividend)} · 총 세후 공급 {formatDiagnosticAmount(firstWithdrawalCashflow.averageSuppliedWithdrawalNet)}
              </p>
            ) : null}
            <p className="mt-1 text-[10px] leading-5 text-slate-400">화면의 억원 입력은 내부 만원 단위로 정규화됩니다. 예: 1.19억원 = 11,900만원 = 119,000,000원.</p>
          </details>
        ) : null}
        {analysis.timing ? (
          <p className="mt-1 text-[10.5px] text-slate-400">
            실행 정보: {analysis.timing.source === "memory-cache"
              ? `메모리 캐시 · 캐시 조회 ${analysis.timing.resultTransferMs.toFixed(1)}ms`
              : `Web Worker · Worker 초기화 ${analysis.timing.workerInitializationMs.toFixed(1)}ms · 데이터 검증 ${analysis.timing.datasetLoadMs.toFixed(1)}ms · 계산 ${analysis.timing.calculationMs.toFixed(1)}ms · 결과 전달 ${analysis.timing.resultTransferMs.toFixed(1)}ms`}{uiRenderMs !== null ? ` · UI commit ${uiRenderMs.toFixed(1)}ms` : ""}
          </p>
        ) : null}
      </details>
    </div>
  ) : null;

  return (
    <section
      aria-labelledby="long-term-sustainability-heading"
      className="relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2 id="long-term-sustainability-heading" className="text-[17px] font-bold text-slate-900 dark:text-white">장기 지속 가능성 분석</h2>
            <InfoTip label="장기 지속 가능성 분석의 의미">
              이 결과는 미래를 정확히 예측하는 확률이 아니라, 현재 사용자 가정과 production dataset 조건에서 계산한 model success rate입니다.
            </InfoTip>
          </div>
          <p className="mt-1 max-w-4xl break-keep text-[13px] leading-6 text-slate-600 dark:text-slate-400">
            과거 시장의 5년 흐름을 재표본화해 10,000개의 가능한 미래 경로를 생성하고, 현재 포트폴리오와 인출 계획이 기간별로 유지되는 비율을 분석합니다.
          </p>
          <p className="mt-1 text-[11.5px] leading-5 text-slate-500">
            Good·Normal·Bad는 대표 경로이며, 이 분석은 여러 시장 순서를 반복 계산한 별도의 확률 분석입니다.
          </p>
        </div>
        <span className="rounded-full border border-slate-200 px-2.5 py-1 text-[10.5px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
          production · {PRODUCTION_MARKET_PATTERN_DATASET_VERSION}
        </span>
      </div>

      {!hydrated ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] text-slate-600 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300">
          저장된 포트폴리오 가정을 불러오고 있습니다.
        </div>
      ) : !portfolioAssumptions ? (
        <div role="status" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-[13px] leading-6 text-blue-900 dark:border-blue-950 dark:bg-blue-950/20 dark:text-blue-200">
          포트폴리오 가정을 저장·적용하면 장기 지속 가능성 분석을 확인할 수 있습니다. 화면의 코드 기본값을 사용자 확정 가정으로 대신 사용하지 않습니다.
        </div>
      ) : targetMonthlyExpenseReal === null ? (
        <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-6 text-amber-900 dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-200">
          목표 월생활비를 입력하면 필수 세후 현금흐름 충족 기준의 장기 분석을 확인할 수 있습니다.
        </div>
      ) : prepared.inputError ? (
        <ErrorState error={prepared.inputError} onRetry={() => setRetryToken((value) => value + 1)} />
      ) : analysis.status === "error" && analysis.error ? (
        <ErrorState error={analysis.error} onRetry={() => setRetryToken((value) => value + 1)} />
      ) : analysis.status === "loading" && !analysis.result ? (
        <div role="status" aria-live="polite" className="mt-5" aria-label="장기 경로 계산 중">
          <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">10,000개의 장기 경로를 분석하고 있습니다.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
          </div>
          <div className="mt-4 h-64 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : resultContent}

      {analysis.refreshing ? (
        <div role="status" aria-live="polite" className="absolute inset-x-4 top-32 z-20 mx-auto max-w-sm rounded-xl border border-blue-200 bg-white/95 px-4 py-3 text-center text-[12px] font-semibold text-blue-800 shadow-lg backdrop-blur dark:border-blue-900 dark:bg-slate-950/95 dark:text-blue-200">
          입력 변경을 반영해 10,000개 경로를 다시 계산하고 있습니다.
        </div>
      ) : null}
    </section>
  );
}
