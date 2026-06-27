"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { quoteDividendsPath, quoteDividendsPrecisePath, quoteHistoryPath, quoteLastPath } from "@/lib/quote-client";
import { DEFAULT_DETAIL_RANGE, INDEX_DEFS, fetchIndexQuote, type DetailLinePoint, type IndexDef, type IndexQuote } from "@/lib/market-index";
import { buildSchdDetailLineTabs } from "@/lib/schd-detail-tabs";
import type { QuoteDividendsResponse, QuoteHistoryResponse, QuoteLastResponse } from "@/lib/quote-types";
const IndexSparkline = dynamic(() => import("@/components/market/IndexSparkline"), { ssr: false });
// Reuse the exact market detail chart (lightweight-charts); load client-only when opened.
const IndexDetailModal = dynamic(() => import("@/components/market/IndexDetailModal"), { ssr: false });

// Same SCHD definition the 시장현황 page feeds into the detail chart.
const SCHD_INDEX_DEF: IndexDef = INDEX_DEFS.find((def) => def.symbol === "SCHD") ?? {
  symbol: "SCHD",
  name: "SCHD",
  ticker: "SCHD",
  description: "Schwab US Dividend Equity",
};

import {
  SCHD_RANGE_OPTIONS,
  SCHD_SEEKING_ALPHA_URL,
  calculateSchdAttractiveness,
  filterSchdRange,
  getSchdAssessment,
  type SchdAttractivenessMetrics,
  type SchdDividendGrowthRow,
  type SchdDividendHistoryRow,
  type SchdRangeKey,
} from "@/lib/schd-attractiveness";

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

function fmtCurrency(value: number | null | undefined) {
  return Number.isFinite(value ?? NaN) ? `$${(value as number).toFixed(2)}` : "조회 불가";
}
// Exact dividend amount as provided by the source (no rounding / zero padding).
function fmtRawAmount(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "조회 불가";
  return `$${Number((value as number).toFixed(6))}`;
}
function fmtPercent(value: number | null | undefined, digits = 2) {
  return Number.isFinite(value ?? NaN) ? `${(value as number).toFixed(digits)}%` : "조회 불가";
}
// Signed percent for YoY / growth columns ("+3.24%" / "-2.96%"), "-" when null.
function fmtSignedPercent(value: number | null | undefined, digits = 2) {
  if (!Number.isFinite(value ?? NaN)) return "-";
  const v = value as number;
  return `${v > 0 ? "+" : ""}${v.toFixed(digits)}%`;
}
function changeToneClass(value: number | null | undefined) {
  if (!Number.isFinite(value ?? NaN)) return "text-slate-400 dark:text-slate-500";
  if ((value as number) > 0) return "text-emerald-600 dark:text-emerald-400";
  if ((value as number) < 0) return "text-rose-600 dark:text-rose-400";
  return "text-slate-500 dark:text-slate-400";
}
function fmtDateTick(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return date;
  return `${String(d.getUTCFullYear()).slice(2)}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function fmtTooltipDate(date: string) {
  return date.replaceAll("-", ".");
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getSchdDailyHistoryWindow() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - (365 * 11 + 10));
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

function SchdMiniCandleChart({ onOpen }: { onOpen: () => void }) {
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setError(false);
    fetchIndexQuote("SCHD", "1m")
      .then((data) => { if (active) setQuote(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-[#2a3336] dark:bg-[#191f20] dark:hover:border-blue-500/60"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-black text-slate-900 dark:text-white">SCHD 미니 캔들차트</h2>
        <span className="text-[11px] font-bold text-slate-400">1M</span>
      </div>
      <div className="h-[210px] w-full sm:h-[230px]">
        {quote?.candles.length ? (
          <IndexSparkline candles={quote.candles} height={220} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-xl bg-slate-50 text-xs font-bold text-slate-500 dark:bg-white/5">
            {error ? "SCHD 차트 조회 불가" : "SCHD 차트 로딩 중…"}
          </div>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] font-bold text-slate-400 group-hover:text-blue-500">
        탭하여 상세 캔들차트 보기
      </p>
    </div>
  );
}

function MetricCard({ label, value, subtext, tone = "default" }: { label: string; value: string; subtext: React.ReactNode; tone?: "default" | "expensive" | "watch" | "ok" | "good" | "strong" }) {
  const toneClass = {
    default: "border-slate-200 bg-white dark:border-[#2a3336] dark:bg-[#191f20]",
    expensive: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10",
    watch: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10",
    ok: "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/10",
    good: "border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-500/30 dark:bg-lime-500/10",
    strong: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10",
  }[tone];
  return (
    <div className={`flex min-h-[104px] flex-col items-center justify-center rounded-2xl border p-4 text-center shadow-sm ${toneClass}`}>
      <div className="text-[12px] font-extrabold text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-[26px] font-black tracking-tight text-slate-900 dark:text-white">{value}</div>
      <div className="mt-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">{subtext}</div>
    </div>
  );
}

function CollapsibleHistory({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5"
      >
        <span className="text-[14px] font-extrabold text-slate-900 dark:text-white">{title}</span>
        <span className={`text-[12px] font-bold text-slate-400 transition-transform duration-300 ${open ? "rotate-180" : ""}`}>▼</span>
      </button>
      <div className={`grid transition-all duration-300 ease-in-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

function DividendHistoryTable({ rows }: { rows: SchdDividendHistoryRow[] }) {
  if (!rows.length) return <p className="py-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">표시할 배당 내역이 없습니다.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-[12px]">
        <thead className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <tr>
            <th className="px-2 py-2 font-extrabold">Year</th>
            <th className="px-2 py-2 font-extrabold">Ex-Dividend Date</th>
            <th className="px-2 py-2 text-right font-extrabold">Amount</th>
            <th className="px-2 py-2 text-right font-extrabold">YoY</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={`${row.date}-${row.amount}`}>
              <td className="px-2 py-2 font-bold text-slate-900 dark:text-white">{row.year}</td>
              <td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.date}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900 dark:text-white">{fmtRawAmount(row.amount)}</td>
              <td className={`px-2 py-2 text-right font-bold tabular-nums ${changeToneClass(row.yoyPct)}`}>{fmtSignedPercent(row.yoyPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DividendGrowthTable({ rows }: { rows: SchdDividendGrowthRow[] }) {
  if (!rows.length) return <p className="py-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">표시할 배당성장 데이터가 없습니다.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[12px]">
        <thead className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400">
          <tr>
            <th className="px-2 py-2 font-extrabold">Year</th>
            <th className="px-2 py-2 text-right font-extrabold">Payout Amount</th>
            <th className="px-2 py-2 text-right font-extrabold">Year End Yield</th>
            <th className="px-2 py-2 text-right font-extrabold">전년대비 배당성장률</th>
            <th className="px-2 py-2 text-right font-extrabold">TR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-white/10">
          {rows.map((row) => (
            <tr key={row.year}>
              <td className="px-2 py-2 font-bold text-slate-900 dark:text-white">
                {row.year}
                {!row.complete && <span className="ml-1 text-[10px] font-bold text-amber-500">(진행중)</span>}
              </td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-900 dark:text-white">${row.payout.toFixed(4)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{row.yearEndYield == null ? "-" : `${row.yearEndYield.toFixed(2)}%`}</td>
              <td className={`px-2 py-2 text-right font-bold tabular-nums ${changeToneClass(row.annualGrowthPct)}`}>{fmtSignedPercent(row.annualGrowthPct)}</td>
              <td className={`px-2 py-2 text-right font-bold tabular-nums ${changeToneClass(row.totalReturnPct)}`}>{fmtSignedPercent(row.totalReturnPct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SchdAttractivenessSection() {
  const [range, setRange] = useState<SchdRangeKey>("5Y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SchdAttractivenessMetrics | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [growthOpen, setGrowthOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    async function load() {
      try {
        const historyWindow = getSchdDailyHistoryWindow();
        const [history, dividends, last] = await Promise.all([
          fetchJson<QuoteHistoryResponse>(quoteHistoryPath({ ticker: "SCHD", start: historyWindow.start, end: historyWindow.end })),
          fetchJson<QuoteDividendsResponse>(quoteDividendsPath({ ticker: "SCHD", start: historyWindow.start, end: historyWindow.end })),
          fetchJson<QuoteLastResponse>(quoteLastPath({ ticker: "SCHD" })),
        ]);
        // Precise declared dividend amounts for display only; non-fatal if it fails.
        const precise = await fetchJson<QuoteDividendsResponse>(
          quoteDividendsPrecisePath({ ticker: "SCHD", start: historyWindow.start, end: historyWindow.end }),
        ).catch(() => null);
        const next = calculateSchdAttractiveness(history, dividends, last, precise);
        if (!active) return;
        if (!next) {
          setMetrics(null);
          setError("SCHD 배당률 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        } else {
          setMetrics(next);
        }
      } catch (err) {
        console.error("SCHD attractiveness load failed", err);
        if (active) setError("SCHD 배당률 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const chartData = useMemo(() => metrics ? filterSchdRange(metrics.points, range).filter((p) => Number.isFinite(p.ttmYield ?? NaN)) : [], [metrics, range]);
  const assessment = getSchdAssessment(metrics?.currentTtmYield);
  const targetSummary = metrics?.targetRows.slice(0, 3).map((row) => `${row.targetYield} ${fmtCurrency(row.ttmBuyPrice)}`).join(" · ");

  // SCHD Dividend Yield (TTM) as a full daily line series — the SAME source as
  // the main chart above. Fed into the detail modal's "Dividend" tab and reused
  // by the "Spread" tab so no extra dividend data is fetched.
  const dividendYieldSeries = useMemo<DetailLinePoint[]>(
    () =>
      metrics
        ? metrics.points
            .filter((p) => Number.isFinite(p.ttmYield ?? NaN))
            .map((p) => ({ date: p.date, value: p.ttmYield as number }))
        : [],
    [metrics],
  );
  // Extensible line-metric tabs (Dividend / US10Y / Spread). Memoized so the
  // modal doesn't re-resolve on every render. Append more tabs here later
  // (Real Yield / MOVE / VIX …) without touching the modal.
  const detailLineTabs = useMemo(() => buildSchdDetailLineTabs(dividendYieldSeries), [dividendYieldSeries]);

  if (loading) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500 dark:border-[#2a3336] dark:bg-[#191f20]">SCHD 배당률 데이터를 불러오는 중입니다…</div>;

  if (error || !metrics) {
    return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-500/30 dark:bg-amber-500/10"><p className="text-sm font-extrabold text-amber-800 dark:text-amber-200">{error ?? "SCHD 배당률 데이터가 부족합니다."}</p><p className="mt-2 text-xs text-amber-700/80 dark:text-amber-200/70">샘플 데이터로 대체 표시하지 않습니다.</p></div>;
  }

  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="현재 TTM 배당률" value={fmtPercent(metrics.currentTtmYield)} subtext={assessment.label} tone={assessment.tone === "neutral" ? "default" : assessment.tone} />
        <MetricCard label={`현재가 = 52H ${fmtPercent(metrics.drawdownFrom52wHighPct, 1)}`} value={fmtCurrency(metrics.currentPrice)} subtext={<span className="text-[10px] text-emerald-600 dark:text-emerald-300">{targetSummary}</span>} />
        <MetricCard label="5년 평균 배당률" value={fmtPercent(metrics.fiveYearAverageYield)} subtext="일별 TTM 배당률 평균" />
        <MetricCard
          label="최근 4회 배당금"
          value={fmtCurrency(metrics.latestFourDividend)}
          subtext={
            metrics.latestFourDividends.length ? (
              <span>
                {metrics.latestFourDividends.map((amount) => amount.toFixed(2)).join(" + ")}{" "}
                <span className="text-blue-500 dark:text-blue-400">(최신)</span>
              </span>
            ) : (
              "최신일 기준 최근 4개 배당 합계"
            )
          }
        />
        <MetricCard label="최근 분기 배당금" value={fmtRawAmount(metrics.recentQuarterDividendDisplay)} subtext="가장 최근 1회 배당 (실제 지급액)" />
      </div>

      <div>
        <div className="mb-2 text-[12px] font-bold text-slate-500 dark:text-slate-400">조회 기간</div>
        <div className="flex flex-wrap gap-2">
          {SCHD_RANGE_OPTIONS.map((option) => (
            <button key={option} type="button" onClick={() => setRange(option)} className={`rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${range === option ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-[#2a3336] dark:bg-[#191f20] dark:text-slate-400"}`}>{option}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
          <h2 className="mb-3 text-[14px] font-extrabold text-slate-900 dark:text-white">SCHD Dividend Yield TTM</h2>
          {chartData.length ? (
            <div className="h-[420px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d6dee6" opacity={0.7} />
                  <XAxis dataKey="date" tickFormatter={fmtDateTick} minTickGap={42} tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} tick={{ fontSize: 11, fill: "#64748b" }} width={44} />
                  <Tooltip labelFormatter={(label) => fmtTooltipDate(String(label))} formatter={(value) => [`${Number(value).toFixed(2)}%`, "TTM 배당률"]} contentStyle={{ borderRadius: 12, border: "1px solid #dbe3ea" }} />
                  <ReferenceLine y={metrics.fiveYearAverageYield ?? undefined} stroke="#60a5fa" strokeDasharray="6 4" label={{ value: `5년평균 ${fmtPercent(metrics.fiveYearAverageYield)}`, fontSize: 11, fill: "#64748b" }} />
                  <ReferenceLine y={3.5} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "3.5%", fontSize: 10, fill: "#64748b" }} />
                  <ReferenceLine y={3.6} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "3.6%", fontSize: 10, fill: "#64748b" }} />
                  <ReferenceLine y={3.7} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "3.7%", fontSize: 10, fill: "#64748b" }} />
                  <ReferenceLine y={3.8} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "3.8%", fontSize: 10, fill: "#64748b" }} />
                  <Line type="monotone" dataKey="ttmYield" name="TTM 배당률" stroke="#f2994a" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-500 dark:bg-white/5">표시할 SCHD 배당률 데이터가 없습니다.</div>}
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
          <h2 className="mb-3 text-[18px] font-black text-slate-900 dark:text-white">목표가 표</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-[12px]">
              <thead className="bg-slate-50 text-slate-500 dark:bg-white/5 dark:text-slate-400"><tr><th className="px-2 py-2 font-extrabold">목표 배당률</th><th className="px-2 py-2 font-extrabold">TTM 기준 매수가</th><th className="px-2 py-2 font-extrabold">최근 분기×4 기준 매수가</th><th className="px-2 py-2 font-extrabold">현재가 대비 하락률</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                {metrics.targetRows.map((row) => <tr key={row.targetYield}><td className="px-2 py-2 font-bold">{row.targetYield}</td><td className="px-2 py-2">{fmtCurrency(row.ttmBuyPrice)}</td><td className="px-2 py-2">{fmtCurrency(row.quarterBuyPrice)}</td><td className="px-2 py-2">{fmtPercent(row.drawdownPct, 1)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <a href={SCHD_SEEKING_ALPHA_URL} target="_blank" rel="noreferrer" className="mt-4 block text-[12px] font-bold text-slate-500 underline-offset-4 hover:text-blue-600 hover:underline dark:text-slate-400">링크: Seeking Alpha SCHD Dividend Yield 페이지 바로가기</a>
          </div>
          <SchdMiniCandleChart onOpen={() => setDetailOpen(true)} />
        </aside>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CollapsibleHistory title="최근 배당금 히스토리" open={historyOpen} onToggle={() => setHistoryOpen((v) => !v)}>
          <DividendHistoryTable rows={metrics.dividendHistory.slice(0, 20)} />
          <p className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">Amount는 실제 지급 배당금(원본값) 그대로이며, YoY는 전년 동일 분기 대비 증감률입니다.</p>
        </CollapsibleHistory>
        <CollapsibleHistory title="배당성장률 히스토리" open={growthOpen} onToggle={() => setGrowthOpen((v) => !v)}>
          <DividendGrowthTable rows={metrics.dividendGrowthHistory} />
          <p className="mt-2 text-[10px] font-bold text-slate-400 dark:text-slate-500">TR(Total Return)은 배당 재투자를 포함한 해당 연도 총수익률입니다. (주가수익률 + 배당수익률)</p>
        </CollapsibleHistory>
      </div>

      {detailOpen && (
        <IndexDetailModal def={SCHD_INDEX_DEF} initialRange={DEFAULT_DETAIL_RANGE} onClose={() => setDetailOpen(false)} lineTabs={detailLineTabs} priceLabel="Price" />
      )}
    </section>
  );
}
