"use client";

import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { quoteDividendsPath, quoteHistoryPath, quoteLastPath } from "@/lib/quote-client";
import type { QuoteDividendsResponse, QuoteHistoryResponse, QuoteLastResponse } from "@/lib/quote-types";
import {
  SCHD_RANGE_OPTIONS,
  SCHD_SEEKING_ALPHA_URL,
  calculateSchdAttractiveness,
  filterSchdRange,
  getSchdAssessment,
  type SchdAttractivenessMetrics,
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
function fmtPercent(value: number | null | undefined, digits = 2) {
  return Number.isFinite(value ?? NaN) ? `${(value as number).toFixed(digits)}%` : "조회 불가";
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

export default function SchdAttractivenessSection() {
  const [range, setRange] = useState<SchdRangeKey>("5Y");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<SchdAttractivenessMetrics | null>(null);

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
        const next = calculateSchdAttractiveness(history, dividends, last);
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
        <MetricCard label="최근 4회 배당금" value={fmtCurrency(metrics.latestFourDividend)} subtext="최신일 기준 최근 4개 배당 합계" />
        <MetricCard label="최근 분기 배당금" value={fmtCurrency(metrics.recentQuarterDividend)} subtext="가장 최근 1회 배당" />
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

        <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#2a3336] dark:bg-[#191f20]">
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
          <p className="mt-3 text-[11px] text-slate-400">원본 Streamlit 기준: 최신 4회 배당 합계 / 현재가로 TTM 배당률을 계산합니다.</p>
        </aside>
      </div>
    </section>
  );
}
