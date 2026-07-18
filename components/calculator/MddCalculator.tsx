"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import MetricCard from "@/components/MetricCard";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput } from "./CalculatorInputField";
import { fetchQuoteHistory } from "@/lib/calculator-data-provider";
import {
  MDD_PERIODS,
  alignKrwCloses,
  calculateMddFromPrices,
  computeComparisonTable,
  computeDrawdownCompare,
  computeDrawdownEpisodes,
  computeVolatilityStats,
  computeYearlyReturns,
  resolvePeriodWindow,
  slicePrices,
  type PeriodKey,
} from "@/lib/mdd-calculator";
import type { MddEpisode, MddInput, MddSeriesPoint, PricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";
import { nextSortState, sortArrow, sortRows, type SortColumnType, type SortState } from "@/lib/calculator-table-sort";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

const panel =
  "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const cardTitle = "text-[15px] font-bold text-slate-900 dark:text-white";

// ── 색상 (스크린샷 기준) ──
const C_PRICE = "#3182F6"; // 가격/달러 drawdown: 파랑
const C_PEAK = "#16a34a"; // 고점 marker: 초록
const C_TROUGH = "#ef4444"; // 저점/MDD marker: 빨강
const C_RECOVERY = "#f97316"; // 회복일 marker: 주황
const C_KRW = "#f97316"; // 원화 drawdown: 주황
const C_REF = "#9ca3af"; // 기준선: 회색 점선

// ── 날짜 포매터 ──
// x축 날짜: YY.MM (예: 26.03)
function formatAxisDate(iso: string): string {
  if (typeof iso !== "string" || iso.length < 7) return String(iso ?? "");
  return `${iso.slice(2, 4)}.${iso.slice(5, 7)}`;
}
// tooltip 날짜: YYYY.MM.DD (예: 2026.03.15)
function formatTooltipDate(iso: string): string {
  if (typeof iso !== "string" || iso.length < 10) return String(iso ?? "");
  return `${iso.slice(0, 4)}.${iso.slice(5, 7)}.${iso.slice(8, 10)}`;
}

function fmtUsd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtUsdAxis(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}
function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}
function fmtPctAxis(value: number): string {
  return `${Math.round(value)}%`;
}
function fmtKDays(days: number | null | undefined): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return "—";
  return `${days.toLocaleString("ko-KR")}일`;
}

// ── 마커 도형 ──
type ShapeProps = { cx?: number; cy?: number };
function TriangleUp({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  return <path d={`M${cx},${cy - 8} L${cx + 7},${cy + 5} L${cx - 7},${cy + 5} Z`} fill={C_PEAK} stroke="#fff" strokeWidth={1.2} />;
}
function TriangleDown({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  return <path d={`M${cx},${cy + 8} L${cx + 7},${cy - 5} L${cx - 7},${cy - 5} Z`} fill={C_TROUGH} stroke="#fff" strokeWidth={1.2} />;
}
function CircleMarker({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={6} fill={C_RECOVERY} stroke="#fff" strokeWidth={1.2} />;
}
function CrossMarker({ cx, cy }: ShapeProps) {
  if (cx == null || cy == null) return null;
  return <path d={`M${cx - 7},${cy - 7} L${cx + 7},${cy + 7} M${cx - 7},${cy + 7} L${cx + 7},${cy - 7}`} stroke={C_TROUGH} strokeWidth={3.5} strokeLinecap="round" />;
}

type ChartColors = {
  grid: string;
  axis: string;
  tooltipBg: string;
  tooltipBorder: string;
  brushFill: string;
  zeroLine: string;
};

function tooltipCard(colors: ChartColors, title: string, rows: Array<{ label: string; value: string; color?: string }>) {
  return (
    <div
      className="rounded-lg px-3 py-2 text-[12px] shadow-lg"
      style={{ background: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}` }}
    >
      <div className="mb-1 font-bold text-slate-700 dark:text-slate-200">{title}</div>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 text-slate-600 dark:text-slate-300">
          <span style={row.color ? { color: row.color } : undefined}>{row.label}</span>
          <span className="font-semibold" style={row.color ? { color: row.color } : undefined}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

type MddQuoteState = {
  // 이 시세가 어떤 티커의 것인지. 티커 변경 중 이전 티커 데이터로 커스텀 날짜를
  // 잘못 초기화하지 않도록, 현재 조회 대상 티커와 일치할 때만 dateBounds 를 신뢰한다.
  ticker?: string;
  usdPrices: PricePoint[];
  usdSource?: QuoteSource;
  krwPrices: PricePoint[];
  krwSource?: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  error?: string | null;
};

type EpisodeSortKey = keyof MddEpisode;
const episodeColumns: Array<{ key: EpisodeSortKey; label: string; type: SortColumnType }> = [
  { key: "rank", label: "순위", type: "number" },
  { key: "peakDate", label: "고점일", type: "date" },
  { key: "troughDate", label: "저점일", type: "date" },
  { key: "recoveryDate", label: "회복일", type: "date" },
  { key: "mdd", label: "최대 낙폭", type: "number" },
  { key: "declineDays", label: "하락 기간", type: "number" },
  { key: "recoveryDays", label: "회복 기간", type: "number" },
  { key: "totalDays", label: "총 소요", type: "number" },
];

type MddSeriesSortKey = keyof MddSeriesPoint;
const mddSeriesColumns: Array<{ key: MddSeriesSortKey; label: string; type: SortColumnType; className?: string }> = [
  { key: "date", label: "날짜", type: "date", className: "py-2" },
  { key: "close", label: "종가", type: "number" },
  { key: "peak", label: "누적 고점", type: "number" },
  { key: "drawdown", label: "고점 대비 하락률", type: "number" },
  { key: "value", label: "환산 지수", type: "number" },
];


type ChartDebugInfo = {
  name: string;
  length: number;
  firstDates: string[];
  lastDates: string[];
  sampleDateDiffs: string[];
};

function buildChartDebugInfo(name: string, data: Array<{ date?: string }>): ChartDebugInfo {
  const dates = data.map((point) => point.date).filter((date): date is string => typeof date === "string" && date.length > 0);
  const sampleDateDiffs = dates.slice(1, 11).map((date, index) => {
    const previous = dates[index];
    const days = daysBetween(previous, date);
    return `${previous} → ${date}: ${days ?? "?"}일`;
  });
  return {
    name,
    length: data.length,
    firstDates: dates.slice(0, 10),
    lastDates: dates.slice(-10),
    sampleDateDiffs,
  };
}

function daysBetween(start: string, end: string): number | null {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null;
  return Math.max(0, Math.round((e - s) / 86_400_000));
}

export default function MddCalculator({ input, onChange }: { input: MddInput; onChange: (input: MddInput) => void }) {
  const theme = useResolvedTheme();
  const [submitted, setSubmitted] = useState(input);
  // 기간 선택: 1년/3년/5년 프리셋 또는 "custom"(시작일/종료일 직접 선택).
  const [period, setPeriod] = useState<PeriodKey | "custom">("5y");
  // 커스텀 기간의 시작/종료일(YYYY-MM-DD). 데이터 로드 시 보유 범위로 초기화한다.
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");
  const [quote, setQuote] = useState<MddQuoteState>({ usdPrices: [], krwPrices: [], warnings: [] });
  const [loading, setLoading] = useState(false);
  const [segmentSort, setSegmentSort] = useState<SortState<EpisodeSortKey>>({ key: "mdd", direction: "asc" });
  const [priceSort, setPriceSort] = useState<SortState<MddSeriesSortKey>>({ key: "date", direction: "asc" });

  const colors: ChartColors = useMemo(
    () =>
      theme === "dark"
        ? {
            grid: "#2a3336",
            axis: "#94a3b8",
            tooltipBg: "#111516",
            tooltipBorder: "#2a3336",
            brushFill: "#151a1b",
            zeroLine: "#64748b",
          }
        : {
            grid: "#e2e8f0",
            axis: "#64748b",
            tooltipBg: "#ffffff",
            tooltipBorder: "#e2e8f0",
            brushFill: "#f8fafc",
            zeroLine: "#94a3b8",
          },
    [theme],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      try {
        const [usd, krw] = await Promise.all([
          fetchQuoteHistory({ ticker: submitted.ticker, range: "max" }),
          fetchQuoteHistory({ ticker: "KRW=X", range: "max" }),
        ]);
        if (cancelled) return;
        setQuote({
          ticker: submitted.ticker,
          usdPrices: usd.prices.map((p) => ({ date: p.date, close: p.close })),
          usdSource: usd.source,
          krwPrices: krw.prices.map((p) => ({ date: p.date, close: p.close })),
          krwSource: krw.source,
          warnings: usd.warnings,
          updatedAt: usd.updatedAt,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setQuote({
          ticker: submitted.ticker,
          usdPrices: [],
          krwPrices: [],
          usdSource: "sample",
          warnings: [],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  const ticker = submitted.ticker.trim().toUpperCase() || "QQQ";
  // 라이브 데이터가 실제로 들어왔을 때만 차트를 그린다 (가짜/샘플 차트 금지).
  const dataAvailable = quote.usdSource !== "sample" && quote.usdPrices.length >= 2;
  const krwAvailable = quote.krwSource !== "sample" && quote.krwPrices.length >= 2;

  // 현재 조회 대상 티커의 시세가 실제로 도착했는지. 티커를 바꾼 직후에는 아직
  // 이전 티커의 시세가 남아 있을 수 있으므로, 시세의 ticker 태그가 현재 티커와
  // 일치할 때만 "이 티커의 데이터"로 신뢰한다(요구사항 5·6: 로딩 중 잘못된 값 방지).
  const tickerDataReady = quote.ticker === submitted.ticker && quote.usdPrices.length > 0;

  // 해당 티커의 실제 데이터 날짜 범위(커스텀 Date Picker 의 min/max, 초기값 산출용).
  // 티커별 상장 이후 최초 거래일 ~ 최신 거래일. 전역 데이터가 아니라 이 티커의 것.
  const dateBounds = useMemo(() => {
    if (!tickerDataReady) return null;
    return {
      min: quote.usdPrices[0].date,
      max: quote.usdPrices[quote.usdPrices.length - 1].date,
    };
  }, [tickerDataReady, quote.usdPrices]);

  // 커스텀 시작/종료일 기본값을 "해당 티커의 실제 데이터 범위"로 설정한다.
  // 티커가 바뀌어 새 데이터가 도착하면(= quote.ticker 변경) 이전 티커의 날짜를
  // 버리고 새 티커의 상장일~최신일로 재설정한다(요구사항 2·3·6). 같은 티커 안에서는
  // 사용자가 직접 고른 날짜를 유지한다(customTickerRef 가드).
  const customTickerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!dateBounds || !quote.ticker) return;
    if (customTickerRef.current === quote.ticker) return;
    customTickerRef.current = quote.ticker;
    setCustomStart(dateBounds.min);
    setCustomEnd(dateBounds.max);
  }, [dateBounds, quote.ticker]);

  // 커스텀 기간의 유효성: 시작일 > 종료일 이면 잘못된 선택.
  const customInvalid = period === "custom" && Boolean(customStart) && Boolean(customEnd) && customStart > customEnd;

  const analysisWindow = useMemo(() => {
    if (period === "custom") {
      // 잘못된 기간이면 빈 구간을 반환해 계산이 빈 결과가 되도록 하고, 아래에서 안내한다.
      if (!customStart || !customEnd || customStart > customEnd) {
        return { start: customStart || "", end: customEnd || "", clampedToMax: false };
      }
      return { start: customStart, end: customEnd, clampedToMax: false };
    }
    return resolvePeriodWindow(quote.usdPrices, period);
  }, [quote.usdPrices, period, customStart, customEnd]);
  const windowUsd = useMemo(() => slicePrices(quote.usdPrices, analysisWindow.start, analysisWindow.end), [quote.usdPrices, analysisWindow]);
  const krwCloses = useMemo(
    () => (krwAvailable ? alignKrwCloses(quote.usdPrices, quote.krwPrices) : []),
    [krwAvailable, quote.usdPrices, quote.krwPrices],
  );
  const windowKrw = useMemo(() => slicePrices(krwCloses, analysisWindow.start, analysisWindow.end), [krwCloses, analysisWindow]);

  const result = useMemo(
    () => calculateMddFromPrices(submitted, windowUsd, { source: quote.usdSource }),
    [submitted, windowUsd, quote.usdSource],
  );

  const episodes = useMemo(() => computeDrawdownEpisodes(quote.usdPrices, { limit: 8 }), [quote.usdPrices]);
  const yearly = useMemo(() => computeYearlyReturns(quote.usdPrices), [quote.usdPrices]);
  const comparison = useMemo(() => computeComparisonTable(quote.usdPrices), [quote.usdPrices]);
  const volatility = useMemo(() => computeVolatilityStats(quote.usdPrices), [quote.usdPrices]);
  const compareData = useMemo(() => computeDrawdownCompare(windowUsd, windowKrw), [windowUsd, windowKrw]);

  const priceChartData = useMemo(
    () =>
      result.series.map((p) => ({
        date: p.date,
        close: p.close,
        peakMarker: p.date === result.highDate ? p.close : null,
        troughMarker: p.date === result.lowDate ? p.close : null,
        recoveryMarker: result.recoveryDate && p.date === result.recoveryDate ? p.close : null,
      })),
    [result.series, result.highDate, result.lowDate, result.recoveryDate],
  );
  const ddChartData = useMemo(
    () =>
      result.series.map((p) => ({
        date: p.date,
        drawdown: p.drawdown,
        mddMarker: p.date === result.lowDate ? p.drawdown : null,
      })),
    [result.series, result.lowDate],
  );

  const chartDebugInfo = useMemo(
    () => [
      buildChartDebugInfo(`${ticker} 달러 기준 가격`, priceChartData),
      buildChartDebugInfo("고점 대비 하락률 (Drawdown / MDD)", ddChartData),
      buildChartDebugInfo("달러 vs 원화 Drawdown 비교", compareData),
    ],
    [ticker, priceChartData, ddChartData, compareData],
  );

  useEffect(() => {
    if (!dataAvailable) return;
    console.group(`[MDD chart data density] ${ticker} ${period}`);
    chartDebugInfo.forEach((info) => {
      console.log(info.name, {
        length: info.length,
        first10Dates: info.firstDates,
        last10Dates: info.lastDates,
        consecutiveDateDiffs: info.sampleDateDiffs,
      });
    });
    console.groupEnd();
  }, [chartDebugInfo, dataAvailable, period, ticker]);

  const peakToRecoveryDays = result.recovered && result.recoveryDate ? daysBetween(result.highDate, result.recoveryDate) : null;

  const segmentSortType = segmentSort ? episodeColumns.find((c) => c.key === segmentSort.key)?.type ?? "string" : "string";
  const priceSortType = priceSort ? mddSeriesColumns.find((c) => c.key === priceSort.key)?.type ?? "string" : "string";
  const sortedEpisodes = useMemo(
    () => sortRows(episodes, segmentSort?.key, segmentSort?.direction ?? "asc", segmentSortType, (row, key) => row[key]),
    [episodes, segmentSort, segmentSortType],
  );
  const sortedRecent = useMemo(
    () => sortRows(result.series, priceSort?.key, priceSort?.direction ?? "asc", priceSortType, (row, key) => row[key]),
    [result.series, priceSort, priceSortType],
  );
  const today = new Date().toISOString().slice(0, 10);

  // 커스텀 기간이지만 선택 구간에 유효한 시세가 없을 때(잘못된 기간 제외).
  const customNoData = period === "custom" && !customInvalid && dataAvailable && windowUsd.length < 2;
  // 실제로 차트/결과를 그릴 수 있는 상태(기간 내 유효 데이터 2개 이상 + 잘못된 기간 아님).
  const rangeReady = windowUsd.length >= 2 && !customInvalid;

  const periodButtonClass = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors ${
      active
        ? "bg-blue-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-[#1f2728] dark:text-slate-300 dark:hover:bg-[#27302f]"
    }`;

  const periodButtons = (
    <div className="flex flex-wrap gap-1.5">
      {MDD_PERIODS.map((p) => (
        <button
          key={p.key}
          type="button"
          onClick={() => setPeriod(p.key)}
          className={periodButtonClass(period === p.key)}
        >
          {p.label}
        </button>
      ))}
      <button
        key="custom"
        type="button"
        onClick={() => setPeriod("custom")}
        className={periodButtonClass(period === "custom")}
      >
        커스텀
      </button>
    </div>
  );

  // 커스텀 선택 시 시작일/종료일 Date Picker + 유효성 안내. (입력 폼 영역에만 표시)
  // Date Picker 의 value/min/max 는 모두 "현재 티커"의 실제 데이터 범위(dateBounds)를
  // 기준으로 한다. 티커 데이터가 아직 준비되지 않았으면(로딩/티커 변경 직후) 잘못된
  // 값이 먼저 보이지 않도록 비활성화하고 로딩 문구를 노출한다(요구사항 4·5·6).
  const inputCls =
    "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-200";
  const customPickers =
    period === "custom" ? (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <label className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500 dark:text-slate-400">시작일</span>
            <input
              type="date"
              value={dateBounds ? customStart : ""}
              min={dateBounds?.min}
              max={dateBounds?.max}
              disabled={!dateBounds}
              onChange={(e) => setCustomStart(e.target.value)}
              className={inputCls}
            />
          </label>
          <span className="text-slate-400">~</span>
          <label className="flex items-center gap-1.5">
            <span className="font-medium text-slate-500 dark:text-slate-400">종료일</span>
            <input
              type="date"
              value={dateBounds ? customEnd : ""}
              min={dateBounds?.min}
              max={dateBounds?.max}
              disabled={!dateBounds}
              onChange={(e) => setCustomEnd(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        {!dateBounds ? (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            ⏳ ‘{ticker}’ 데이터를 불러오는 중입니다… 잠시 후 기간을 선택할 수 있어요.
          </p>
        ) : customInvalid ? (
          <p className="text-[12px] font-medium text-rose-600 dark:text-rose-400">
            ⚠️ 시작일이 종료일보다 늦습니다. 기간을 다시 선택해주세요.
          </p>
        ) : customNoData ? (
          <p className="text-[12px] font-medium text-amber-600 dark:text-amber-400">
            ⚠️ 선택한 기간에 시세 데이터가 없습니다. 다른 기간을 선택해주세요.
          </p>
        ) : (
          <p className="text-[12px] text-slate-500 dark:text-slate-400">
            분석 가능 범위: {dateBounds.min} ~ {dateBounds.max}
          </p>
        )}
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {/* 입력 영역 */}
      <form className={panel} onSubmit={(e) => { e.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={cardTitle}>티커MDD 계산기 입력값</h2>
            <CalculatorDataStatus source={result.source} loading={loading} updatedAt={result.updatedAt} loadingText="시세 불러오는 중" />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            <Search className="h-4 w-4" />
            분석 실행
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <TextInput label="티커" value={input.ticker} onChange={(v) => onChange({ ...input, ticker: v.toUpperCase() })} />
          <div>
            <label className="mb-1 block text-[12px] font-medium text-slate-500 dark:text-slate-400">분석 기간</label>
            {periodButtons}
            {customPickers}
          </div>
        </div>
        <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-500 dark:border-[#2a3336] dark:bg-[#151a1b] dark:text-slate-400">
          티커MDD 계산을 위해 티커를 입력하고 분석 실행을 누른 뒤, 기간 버튼(1년·3년·5년·최대)으로 분석 구간을 조정하세요. 보유 데이터가 선택한 기간보다 짧으면 자동으로 전체 기간을 보여줍니다. &ldquo;커스텀&rdquo;을 선택하면 해당 티커의 실제 데이터 범위에서 시작일·종료일을 직접 지정할 수 있습니다.
        </p>
      </form>

      <CalculatorWarningPanel warnings={result.warnings} error={quote.error} />

      {!dataAvailable ? (
        <div className={`${panel} text-center`}>
          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200">시세 데이터를 불러올 수 없습니다.</p>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            {loading
              ? "라이브 시세를 불러오는 중입니다…"
              : `'${ticker}' 의 라이브 시세를 가져오지 못했습니다. 티커 철자나 네트워크 상태를 확인한 뒤 다시 시도해주세요. (가짜 데이터로 차트를 그리지 않습니다.)`}
          </p>
        </div>
      ) : period === "custom" && !dateBounds ? (
        // 커스텀 모드에서 현재 티커 데이터가 아직 준비되지 않았을 때(로딩/티커 변경 직후).
        // 이전 티커 기준의 잘못된 결과가 먼저 보이지 않도록 로딩 안내만 표시한다.
        <div className={`${panel} text-center`}>
          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200">‘{ticker}’ 데이터를 불러오는 중입니다…</p>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            티커별 실제 데이터 범위를 확인한 뒤 커스텀 기간을 분석합니다.
          </p>
        </div>
      ) : !rangeReady ? (
        // 커스텀 기간이 잘못되었거나(시작일>종료일) 선택 구간에 데이터가 없을 때의 안내.
        <div className={`${panel} text-center`}>
          <p className="text-[14px] font-bold text-slate-700 dark:text-slate-200">
            {customInvalid ? "잘못된 기간을 선택했습니다." : "선택한 기간에 시세 데이터가 없습니다."}
          </p>
          <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">
            {customInvalid
              ? "시작일이 종료일보다 늦습니다. 시작일과 종료일을 다시 선택해주세요."
              : `분석 가능 범위(${dateBounds?.min ?? "?"} ~ ${dateBounds?.max ?? "?"}) 안에서 다른 기간을 선택해주세요.`}
          </p>
        </div>
      ) : (
        <>
          {/* 분석 기간 배너 */}
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-700 dark:border-[#244233] dark:bg-[#16241c] dark:text-emerald-300">
            ✅ 분석 기간: {analysisWindow.start} ~ {analysisWindow.end} · 데이터 {result.series.length.toLocaleString("ko-KR")}일
            {analysisWindow.clampedToMax && period !== "custom" ? " (보유 데이터가 선택 기간보다 짧아 전체 기간을 표시합니다)" : ""}
          </div>

          <details className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-[12px] text-blue-900 dark:border-[#1e3a5f] dark:bg-[#101b2a] dark:text-blue-100">
            <summary className="cursor-pointer text-[13px] font-bold">최종 Recharts data 배열 검증</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {chartDebugInfo.map((info) => (
                <div key={info.name} className="rounded-xl border border-blue-100 bg-white/70 p-3 dark:border-[#284763] dark:bg-[#111827]">
                  <div className="font-bold">{info.name}</div>
                  <div className="mt-1">chart data length: <span className="font-bold">{info.length.toLocaleString("ko-KR")}</span></div>
                  <div className="mt-2 font-semibold">첫 10개 date</div>
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px]">{info.firstDates.join("\n") || "—"}</pre>
                  <div className="mt-2 font-semibold">마지막 10개 date</div>
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px]">{info.lastDates.join("\n") || "—"}</pre>
                  <div className="mt-2 font-semibold">연속 데이터 간 날짜 차이</div>
                  <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[11px]">{info.sampleDateDiffs.join("\n") || "—"}</pre>
                </div>
              ))}
            </div>
          </details>

          {/* 상단 KPI */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard label="현재가" value={fmtUsd(result.currentPrice)} sub={`${ticker} · ${result.source === "yahoo" ? "Yahoo" : result.source === "stooq" ? "Stooq" : result.source}`} tone="blue" />
            <MetricCard label="기간 내 최고가" value={fmtUsd(result.peakPrice)} sub="기간 최고 종가" tone="green" />
            <MetricCard label="현재 고점대비 하락률" value={fmtPct(result.currentDrawdown)} sub="누적 고점 대비" tone="orange" />
            <MetricCard label="최대 MDD" value={fmtPct(result.maxDrawdown)} sub="기간 내 최대 낙폭" tone="gray" />
            <MetricCard label="MDD 고점일" value={result.highDate} sub={`고점가 ${fmtUsd(result.peakPrice2)}`} tone="green" />
            <MetricCard
              label="MDD 저점일 → 회복일"
              value={result.recovered && result.recoveryDate ? `${result.lowDate} → ${result.recoveryDate}` : `${result.lowDate}`}
              sub={result.recovered ? (peakToRecoveryDays ? `약 ${peakToRecoveryDays}일 만에 회복` : "회복 완료") : "미회복"}
              tone="orange"
            />
          </div>

          {result.recovered && result.recoveryDate && peakToRecoveryDays !== null ? (
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">
              ⏱️ 고점({result.highDate})에서 회복까지 약 <span className="font-bold text-slate-700 dark:text-slate-200">{peakToRecoveryDays}일</span> 소요되었습니다.
            </p>
          ) : (
            <p className="text-[12.5px] text-slate-500 dark:text-slate-400">⏱️ 아직 직전 고점가를 회복하지 못했습니다. (미회복)</p>
          )}

          {/* 그래프 1 — 가격 */}
          <div className={panel}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className={cardTitle}>{ticker} 달러 기준 가격</h2>
              {periodButtons}
            </div>
            <div className="h-[340px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={priceChartData} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={formatAxisDate} minTickGap={36} />
                  <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmtUsdAxis} width={56} domain={["auto", "auto"]} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload && payload.length
                        ? tooltipCard(colors, formatTooltipDate(String(label)), [
                            { label: "종가", value: fmtUsd(Number(payload[0]?.payload?.close)), color: C_PRICE },
                          ])
                        : null
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="linear" dataKey="close" name={`${ticker} 종가`} stroke={C_PRICE} strokeWidth={1.8} dot={false} />
                  <Scatter dataKey="peakMarker" name="MDD 고점" shape={<TriangleUp />} legendType="triangle" fill={C_PEAK} isAnimationActive={false} />
                  <Scatter dataKey="troughMarker" name="MDD 저점" shape={<TriangleDown />} legendType="triangle" fill={C_TROUGH} isAnimationActive={false} />
                  <Scatter dataKey="recoveryMarker" name="회복일" shape={<CircleMarker />} legendType="circle" fill={C_RECOVERY} isAnimationActive={false} />
                  <Brush dataKey="date" height={24} stroke={C_PRICE} fill={colors.brushFill} travellerWidth={8} tickFormatter={formatAxisDate} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 그래프 2 — Drawdown / MDD */}
          <div className={panel}>
            <h2 className={`${cardTitle} mb-3`}>고점 대비 하락률 (Drawdown / MDD)</h2>
            <div className="h-[320px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={ddChartData} margin={{ top: 8, right: 44, bottom: 8, left: 4 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={formatAxisDate} minTickGap={36} />
                  <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmtPctAxis} width={48} domain={["auto", 0]} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload && payload.length
                        ? tooltipCard(colors, formatTooltipDate(String(label)), [
                            { label: "고점 대비 하락률", value: fmtPct(Number(payload[0]?.payload?.drawdown)), color: C_PRICE },
                          ])
                        : null
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke={colors.zeroLine} />
                  {[-10, -20, -30, -40].map((level) => (
                    <ReferenceLine
                      key={level}
                      y={level}
                      stroke={C_REF}
                      strokeDasharray="4 4"
                      label={{ value: `${level}%`, position: "right", fill: colors.axis, fontSize: 10 }}
                    />
                  ))}
                  <Area type="linear" dataKey="drawdown" name="Drawdown" stroke={C_PRICE} strokeWidth={1.6} fill={C_PRICE} fillOpacity={0.1} />
                  <Scatter
                    dataKey="mddMarker"
                    name={`최대 MDD (${fmtPct(result.maxDrawdown)})`}
                    shape={<CrossMarker />}
                    legendType="cross"
                    fill={C_TROUGH}
                    isAnimationActive={false}
                  />
                  <Brush dataKey="date" height={24} stroke={C_PRICE} fill={colors.brushFill} travellerWidth={8} tickFormatter={formatAxisDate} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">
              ℹ️ MDD(최대낙폭)는 기간 내 고점 대비 최대 하락률입니다. 기준선은 -10% / -20% / -30% / -40% 입니다.
            </p>
          </div>

          {/* 그래프 3 — 달러 vs 원화 Drawdown 비교 */}
          <div className={panel}>
            <h2 className={`${cardTitle} mb-3`}>달러 vs 원화 Drawdown 비교</h2>
            <div className="h-[300px] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareData} margin={{ top: 8, right: 44, bottom: 8, left: 4 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={formatAxisDate} minTickGap={36} />
                  <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmtPctAxis} width={48} domain={["auto", 0]} />
                  <Tooltip
                    content={({ active, payload, label }) =>
                      active && payload && payload.length
                        ? tooltipCard(colors, formatTooltipDate(String(label)), [
                            { label: "달러 기준", value: fmtPct(Number(payload[0]?.payload?.usd)), color: C_PRICE },
                            ...(krwAvailable ? [{ label: "원화 기준", value: fmtPct(Number(payload[0]?.payload?.krw)), color: C_KRW }] : []),
                          ])
                        : null
                    }
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={0} stroke={colors.zeroLine} />
                  {[-10, -20, -30, -40].map((level) => (
                    <ReferenceLine key={level} y={level} stroke={C_REF} strokeDasharray="4 4" label={{ value: `${level}%`, position: "right", fill: colors.axis, fontSize: 10 }} />
                  ))}
                  <Line type="linear" dataKey="usd" name="달러 기준" stroke={C_PRICE} strokeWidth={1.6} dot={false} />
                  {krwAvailable ? <Line type="linear" dataKey="krw" name="원화 기준" stroke={C_KRW} strokeWidth={1.6} dot={false} connectNulls /> : null}
                  <Brush dataKey="date" height={24} stroke={C_PRICE} fill={colors.brushFill} travellerWidth={8} tickFormatter={formatAxisDate} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {krwAvailable ? (
              <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">
                ℹ️ 원화 기준은 달러 종가에 USD/KRW 환율을 곱해 계산한 한국 투자자 체감 낙폭입니다. 하락장에서 원화가 약세면 원화 낙폭이 더 작아질 수 있습니다.
              </p>
            ) : (
              <p className="mt-3 text-[12px] text-amber-600 dark:text-amber-400">
                ⚠️ USD/KRW 환율 데이터를 불러오지 못해 원화 기준 비교를 생략합니다. 달러 기준 낙폭만 표시합니다.
              </p>
            )}
          </div>

          {/* 역대 최대 낙폭/회복기간 */}
          <div className={panel}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className={cardTitle}>역대 최대 낙폭과 회복기간</h2>
              <TableCsvMenu filename={`mdd-drawdown-segments-${ticker}-${today}.csv`} rows={sortedEpisodes} columns={episodeColumns.map((column) => ({ header: column.label, value: (row: MddEpisode) => { const value = row[column.key]; return typeof value === "boolean" ? (value ? "예" : "아니오") : value; } }))} />
            </div>
            <p className="mb-3 text-[12px] text-slate-500 dark:text-slate-400">전체 보유 데이터 기준, 심한 낙폭 순으로 정렬했습니다.</p>
            {sortedEpisodes.length === 0 ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">표시할 낙폭 구간이 충분하지 않습니다.</p>
            ) : (
              <div className="-mx-5 max-h-[520px] min-w-0 overflow-auto px-5">
                <table className="w-full min-w-[760px] text-left text-[12.5px]">
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr className="border-b border-slate-200 dark:border-[#2a3336]">
                      {episodeColumns.map((column) => (
                        <th key={column.key} className="sticky top-0 z-10 bg-white py-2 dark:bg-[#191f20]">
                          <button type="button" className="whitespace-nowrap text-left hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setSegmentSort((current) => nextSortState(current, column.key))}>
                            {column.label}{sortArrow(segmentSort, column.key)}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEpisodes.map((row) => (
                      <tr key={`${row.peakDate}-${row.troughDate}`} className="border-b border-slate-100 text-slate-600 last:border-0 dark:border-[#222a2c] dark:text-slate-300">
                        <td className="py-2 font-semibold text-slate-900 dark:text-white">{row.rank}</td>
                        <td>{row.peakDate}</td>
                        <td>{row.troughDate}</td>
                        <td>{row.recoveryDate ?? <span className="text-amber-600 dark:text-amber-400">미회복</span>}</td>
                        <td className="font-semibold text-red-500 dark:text-red-300">{fmtPct(row.mdd)}</td>
                        <td>{fmtKDays(row.declineDays)}</td>
                        <td>{row.recovered ? fmtKDays(row.recoveryDays) : "—"}</td>
                        <td>{row.recovered ? fmtKDays(row.totalDays) : "미회복"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 연도별 수익률 */}
          <div className={panel}>
            <h2 className={`${cardTitle} mb-3`}>{ticker} 주식 연도별 수익률</h2>
            {yearly.length === 0 ? (
              <p className="text-[13px] text-slate-500 dark:text-slate-400">연도별 수익률을 계산할 데이터가 부족합니다.</p>
            ) : (
              <div className="h-[300px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearly} margin={{ top: 8, right: 16, bottom: 8, left: 4 }}>
                    <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="year" stroke={colors.axis} tick={{ fontSize: 11 }} minTickGap={12} />
                    <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} tickFormatter={fmtPctAxis} width={48} />
                    <Tooltip
                      content={({ active, payload, label }) =>
                        active && payload && payload.length
                          ? tooltipCard(colors, `${label}년${payload[0]?.payload?.partial ? " (진행 중)" : ""}`, [
                              { label: "수익률", value: fmtPct(Number(payload[0]?.payload?.returnPct)), color: Number(payload[0]?.payload?.returnPct) >= 0 ? C_PRICE : C_TROUGH },
                            ])
                          : null
                      }
                    />
                    <ReferenceLine y={0} stroke={colors.zeroLine} />
                    <Bar dataKey="returnPct" name="연도별 수익률">
                      {yearly.map((row) => (
                        <Cell key={row.year} fill={row.returnPct >= 0 ? C_PRICE : C_TROUGH} fillOpacity={row.partial ? 0.55 : 0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400">연도별 수익률 = 해당 연도 마지막 종가 / 해당 연도 첫 종가 - 1. 진행 중인 연도는 옅게 표시됩니다.</p>
          </div>

          {/* 종목 기본 정보 표 (비교 기준년도 + 주요 변동성 지표) */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* 비교 기준년도 */}
            <div className={panel}>
              <h2 className={`${cardTitle} mb-3`}>비교 기준년도별 수익률</h2>
              <table className="w-full text-left text-[12.5px]">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-[#2a3336]">
                    <th className="py-2">비교기준년도</th>
                    <th className="py-2 text-right">연평균수익률</th>
                    <th className="py-2 text-right">총수익률</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 text-slate-600 last:border-0 dark:border-[#222a2c] dark:text-slate-300">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">{row.label}</td>
                      {row.available ? (
                        <>
                          <td className="text-right">{fmtPct(row.cagrPct)}</td>
                          <td className="text-right font-semibold">{fmtPct(row.totalReturnPct)}</td>
                        </>
                      ) : (
                        <td className="py-2 text-right text-slate-400 dark:text-slate-500" colSpan={2}>데이터 부족</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 주요 변동성 지표 */}
            <div className={panel}>
              <h2 className={`${cardTitle} mb-3`}>주요 변동성 지표 (단위: USD, %)</h2>
              <table className="w-full text-left text-[12.5px]">
                <tbody>
                  {[
                    { label: "52주 최고가", value: fmtUsd(volatility.high52w) },
                    { label: "52주 최저가", value: fmtUsd(volatility.low52w) },
                    { label: "1년전 대비 상승률", value: fmtPct(volatility.return1yPct) },
                    { label: "고점대비 하락률", value: fmtPct(volatility.currentDrawdownPct) },
                    { label: "최대 낙폭(MDD)", value: fmtPct(volatility.maxDrawdownPct) },
                    { label: "연 최고 수익률(Year Best)", value: fmtPct(volatility.yearBestPct) },
                    { label: "연 최저 수익률(Year Worst)", value: fmtPct(volatility.yearWorstPct) },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-slate-100 last:border-0 dark:border-[#222a2c]">
                      <td className="py-2.5 text-slate-600 dark:text-slate-300">{row.label}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-900 dark:text-white">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 최근 가격 및 Drawdown 상세 (최하단) */}
          <div className={panel}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className={cardTitle}>최근 가격 및 Drawdown 상세</h2>
              <TableCsvMenu filename={`mdd-recent-drawdown-${ticker}-${today}.csv`} rows={sortedRecent} columns={mddSeriesColumns.map((column) => ({ header: column.label, value: (row: MddSeriesPoint) => row[column.key] }))} />
            </div>
            <div className="-mx-5 max-h-[520px] min-w-0 overflow-auto px-5">
              <table className="w-full min-w-[600px] text-left text-[12.5px]">
                <thead className="text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-slate-200 dark:border-[#2a3336]">
                    {mddSeriesColumns.map((column) => (
                      <th key={column.key} className={`${column.className ?? ""} sticky top-0 z-10 bg-white dark:bg-[#191f20]`}>
                        <button type="button" className="whitespace-nowrap text-left hover:text-slate-800 dark:hover:text-slate-200" onClick={() => setPriceSort((current) => nextSortState(current, column.key))}>
                          {column.label}{sortArrow(priceSort, column.key)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedRecent.map((row) => (
                    <tr key={row.date} className="border-b border-slate-100 text-slate-600 last:border-0 dark:border-[#222a2c] dark:text-slate-300">
                      <td className="py-2 font-semibold text-slate-900 dark:text-white">{row.date}</td>
                      <td>{fmtUsd(row.close)}</td>
                      <td>{fmtUsd(row.peak)}</td>
                      <td className="text-orange-500 dark:text-orange-300">{fmtPct(row.drawdown)}</td>
                      <td>{row.value.toLocaleString("ko-KR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
