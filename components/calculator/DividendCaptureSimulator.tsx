"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput, NumberInput, SelectInput } from "./CalculatorInputField";
import { fetchQuoteDividends, fetchQuoteHistory } from "@/lib/calculator-data-provider";
import { resolveDividendCaptureDates, simulateDividendCapture } from "@/lib/dividend-capture-calculator";
import type { DividendCaptureDividendPoint, DividendCaptureInput, DividendCapturePricePoint, DividendCaptureRow } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";
import { CartesianGrid, Cell, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { nextSortState, sortArrow, sortRows, type SortColumnType, type SortState } from "@/lib/calculator-table-sort";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

type DividendCaptureQuoteState = {
  prices?: DividendCapturePricePoint[];
  dividends?: DividendCaptureDividendPoint[];
  source?: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  error?: string | null;
};

function combineSource(historySource: QuoteSource, dividendSource: QuoteSource): QuoteSource {
  if (historySource === "sample" || dividendSource === "sample") return "sample";
  if (historySource === "stooq") return "stooq";
  return "yahoo";
}

function latestUpdatedAt(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1);
}

type DividendSortKey = keyof Pick<DividendCaptureRow, "exDate" | "buyPrice" | "afterTaxDividend" | "breakevenPrice" | "profitPct" | "recoveryDate" | "recoveryTradingDays" | "recoveryCalendarDays" | "result">;

const dividendColumns: Array<{ key: DividendSortKey; label: string; type: SortColumnType; className?: string }> = [
  { key: "exDate", label: "배당락일", type: "date", className: "py-2" },
  { key: "buyPrice", label: "매수가", type: "number" },
  { key: "afterTaxDividend", label: "세후배당금", type: "number" },
  { key: "breakevenPrice", label: "손익분기점", type: "number" },
  { key: "result", label: "성공여부", type: "string" },
  { key: "profitPct", label: "수익률(%)", type: "number" },
  { key: "recoveryDate", label: "원금 회복 날짜", type: "date" },
  { key: "recoveryTradingDays", label: "소요 기간(거래일)", type: "number" },
  { key: "recoveryCalendarDays", label: "소요 기간(달력)", type: "number" },
];

function DividendTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: DividendCaptureRow }> }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#2a3336] bg-[#111516] p-3 text-[12px] text-slate-200 shadow-xl">
      <div className="font-bold text-white">배당락일: {row.exDate}</div>
      <div>수익률: {row.profitPct}%</div>
      <div>성공여부: {row.result}</div>
      <div>원금 회복: {row.recoveryDate}</div>
      <div>소요 기간: {row.recoveryTradingDays} / {row.recoveryCalendarDays}</div>
    </div>
  );
}

function toQuoteRequest(input: DividendCaptureInput) {
  const { start, end } = resolveDividendCaptureDates(input);
  if (input.recent5yOnly) return { ticker: input.ticker, range: "5y", end };
  return { ticker: input.ticker, range: "max", start, end };
}

export default function DividendCaptureSimulator({ input, onChange }: { input: DividendCaptureInput; onChange: (input: DividendCaptureInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const [quoteState, setQuoteState] = useState<DividendCaptureQuoteState>({ warnings: [] });
  const [loading, setLoading] = useState(false);
  const [detailSort, setDetailSort] = useState<SortState<DividendSortKey>>({ key: "exDate", direction: "asc" });

  useEffect(() => {
    let cancelled = false;

    async function loadDividendCaptureData() {
      setLoading(true);
      setQuoteState((previous) => ({ ...previous, error: null }));

      try {
        const request = toQuoteRequest(submitted);
        const [historyResponse, dividendsResponse] = await Promise.all([
          fetchQuoteHistory(request),
          fetchQuoteDividends(request),
        ]);
        if (cancelled) return;

        setQuoteState({
          prices: historyResponse.prices.map((point) => ({
            date: point.date,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
          })),
          dividends: dividendsResponse.dividends.map((point) => ({ date: point.date, amount: point.amount })),
          source: combineSource(historyResponse.source, dividendsResponse.source),
          warnings: [
            ...historyResponse.warnings.map((w) => `${historyResponse.normalizedTicker} history: ${w}`),
            ...dividendsResponse.warnings.map((w) => `${dividendsResponse.normalizedTicker} dividends: ${w}`),
            ...(historyResponse.source !== dividendsResponse.source
              ? [`Mixed quote sources: history=${historyResponse.source}, dividends=${dividendsResponse.source}.`]
              : []),
          ],
          updatedAt: latestUpdatedAt([historyResponse.updatedAt, dividendsResponse.updatedAt]),
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setQuoteState({
          prices: [],
          dividends: [],
          source: "sample",
          warnings: [`Quote history/dividends request failed; sample fallback was used: ${error instanceof Error ? error.message : String(error)}`],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDividendCaptureData();
    return () => { cancelled = true; };
  }, [submitted]);

  const result = useMemo(
    () =>
      simulateDividendCapture(
        submitted,
        { prices: quoteState.prices, dividends: quoteState.dividends },
        { source: quoteState.source, warnings: quoteState.warnings, updatedAt: quoteState.updatedAt },
      ),
    [quoteState.dividends, quoteState.prices, quoteState.source, quoteState.updatedAt, quoteState.warnings, submitted],
  );
  const update = <K extends keyof DividendCaptureInput>(key: K, value: DividendCaptureInput[K]) => onChange({ ...input, [key]: value });
  const dividendSortType = detailSort ? dividendColumns.find((column) => column.key === detailSort.key)?.type ?? "string" : "string";
  const sortedRows = useMemo(() => sortRows(result.rows, detailSort?.key, detailSort?.direction ?? "asc", dividendSortType, (row, key) => row[key]), [detailSort, dividendSortType, result.rows]);

  return (
    <div className="space-y-4">
      {/* Input form */}
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">입력값</h2>
            <CalculatorDataStatus
              source={result.source}
              loading={loading}
              updatedAt={result.updatedAt}
              loadingText="loading history/dividends"
              extra={`${result.usedStartDate} ~ ${result.usedEndDate}`}
            />
          </div>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
            <Search className="h-4 w-4" />
            백테스트 실행
          </button>
        </div>
        {/* 원본 Streamlit 배당치기 시뮬레이터의 입력항목만 노출한다 (#7-1). */}
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
          <TextInput label="티커 (예: SCHD, ARCC)" value={input.ticker} onChange={(v) => update("ticker", v.toUpperCase())} />
          <NumberInput label="투자자금 (달러)" value={input.investmentAmount} onChange={(v) => update("investmentAmount", v)} />
          <SelectInput label="매수가 기준" value={input.buyType} onChange={(v) => update("buyType", v as DividendCaptureInput["buyType"])}>
            <option value="D-1 종가">D-1 종가</option>
            <option value="D-1 시가">D-1 시가</option>
            <option value="D-2 종가">D-2 종가</option>
            <option value="D-2 시가">D-2 시가</option>
          </SelectInput>
          <NumberInput label="매도허용기간 (N거래일)" value={input.sellWindow} onChange={(v) => update("sellWindow", v)} />
          <NumberInput label="배당소득세율 (%)" value={input.taxRate} onChange={(v) => update("taxRate", v)} />
          <SelectInput label="최근 5년 데이터만 보기" value={input.recent5yOnly ? "true" : "false"} onChange={(v) => update("recent5yOnly", v === "true")}>
            <option value="false">아니오</option>
            <option value="true">예</option>
          </SelectInput>
        </div>
      </form>

      {result.rows.length > 0 && (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-[13px] text-emerald-100">
          <p className="font-bold">총 {result.rows.length}회의 과거 배당 이벤트 분석 완료! (적용 세율: {submitted.taxRate}%)</p>
          <p className="mt-1 text-emerald-200/90">📅 백테스트 기간: {result.rows[0]?.exDate} ~ {result.rows.at(-1)?.exDate}</p>
        </div>
      )}

      {/* Warnings */}
      <CalculatorWarningPanel warnings={result.warnings} error={quoteState.error} />

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="전략 승률" value={`${result.successRate}%`} sub={`${result.rows.length}회 분석`} tone="green" />
        <MetricCard label="성공 평균수익률" value={`${result.successAverageReturnPct.toFixed(2)}%`} sub="성공 case 평균" tone="blue" />
        <MetricCard label="실패 평균손실률" value={`${result.failureAverageLossPct.toFixed(2)}%`} sub="실패 case 평균" tone="orange" />
        <MetricCard label="손익비" value={result.rewardRiskRatio === null ? "∞" : result.rewardRiskRatio.toFixed(2)} sub="성공/실패 절대비" tone="gray" />
        <MetricCard label="1회 기대수익률" value={`${result.expectedReturnPct.toFixed(2)}%`} sub="전체 평균 수익률" tone="green" />
        <MetricCard label="1회 절세예상액" value={`$${result.taxSavingPerTrade.toFixed(2)}`} sub="원본 Streamlit 산식" tone="blue" />
      </div>

      {/* Chart */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">수익률 분포 그래프</h2>
        <div className="h-[280px] min-w-0 sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="exDate" name="배당락일" stroke="#94a3b8" tick={{ fontSize: 11 }} minTickGap={24} angle={-30} textAnchor="end" height={54} />
              <YAxis dataKey="profitPct" name="수익률" unit="%" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<DividendTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Scatter data={result.rows.filter((row) => row.result === "성공")} name="성공">
                {result.rows.filter((row) => row.result === "성공").map((entry) => <Cell key={entry.exDate} fill="#3b82f6" />)}
              </Scatter>
              <Scatter data={result.rows.filter((row) => row.result === "실패")} name="실패">
                {result.rows.filter((row) => row.result === "실패").map((entry) => <Cell key={entry.exDate} fill="#93c5fd" />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {result.warning && <p className="mt-3 text-[12px] text-slate-500">{result.warning}</p>}
      </div>

      {/* Detail table */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">회차별 상세 결과</h2>
        <div className="-mx-5 max-h-[520px] min-w-0 overflow-auto px-5">
          <table className="w-full min-w-[920px] text-left text-[12px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                {dividendColumns.map((column) => (
                  <th key={column.key} className={`${column.className ?? ""} sticky top-0 z-10 bg-[#191f20]`}>
                    <button type="button" className="whitespace-nowrap text-left hover:text-slate-200" onClick={() => setDetailSort((current) => nextSortState(current, column.key))}>
                      {column.label}{sortArrow(detailSort, column.key)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.exDate} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.exDate}</td>
                  <td>${row.buyPrice}</td>
                  <td>${row.afterTaxDividend}</td>
                  <td>${row.breakevenPrice}</td>
                  <td className={row.result === "성공" ? "text-green-400" : "text-red-400"}>{row.result}</td>
                  <td>{row.profitPct}%</td>
                  <td>{row.recoveryDate}</td>
                  <td>{row.recoveryTradingDays}</td>
                  <td>{row.recoveryCalendarDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
