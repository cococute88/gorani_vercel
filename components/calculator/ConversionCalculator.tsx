"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput, DateInput } from "./CalculatorInputField";
import { fetchQuoteHistory } from "@/lib/calculator-data-provider";
import { calculateConversion } from "@/lib/conversion-calculator";
import type { ConversionInput, ConversionPricePoint, ConversionRow } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { nextSortState, sortArrow, sortRows, type SortColumnType, type SortState } from "@/lib/calculator-table-sort";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";


type ConversionSortKey = keyof ConversionRow;
const conversionColumns: Array<{ key: ConversionSortKey; label: string; type: SortColumnType; className?: string }> = [
  { key: "date", label: "일자", type: "date", className: "py-2" },
  { key: "sellPrice", label: "매도 가격", type: "number" },
  { key: "buyPrice", label: "매수 가격", type: "number" },
  { key: "ratio", label: "전환비", type: "number" },
  { key: "averageRatio", label: "평균 전환비", type: "number" },
  { key: "deviationPct", label: "괴리율", type: "number" },
  { key: "signal", label: "판정", type: "string" },
];

type ConversionQuoteState = {
  sellPrices?: ConversionPricePoint[];
  buyPrices?: ConversionPricePoint[];
  source?: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  error?: string | null;
};

function combineSource(sellSource: QuoteSource, buySource: QuoteSource): QuoteSource {
  if (sellSource === "sample" || buySource === "sample") return "sample";
  if (sellSource === "stooq" || buySource === "stooq") return "stooq";
  return "yahoo";
}

function latestUpdatedAt(values: Array<string | undefined>) {
  return values.filter(Boolean).sort().at(-1);
}

export default function ConversionCalculator({ input, onChange }: { input: ConversionInput; onChange: (input: ConversionInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const [quoteState, setQuoteState] = useState<ConversionQuoteState>({ warnings: [] });
  const [loading, setLoading] = useState(false);
  const [detailSort, setDetailSort] = useState<SortState<ConversionSortKey>>({ key: "date", direction: "asc" });

  useEffect(() => {
    let cancelled = false;

    async function loadHistories() {
      setLoading(true);
      setQuoteState((previous) => ({ ...previous, error: null }));

      try {
        const [sellResponse, buyResponse] = await Promise.all([
          fetchQuoteHistory({ ticker: submitted.sellTicker, start: submitted.startDate, end: submitted.endDate }),
          fetchQuoteHistory({ ticker: submitted.buyTicker, start: submitted.startDate, end: submitted.endDate }),
        ]);
        if (cancelled) return;

        setQuoteState({
          sellPrices: sellResponse.prices.map((point) => ({ date: point.date, close: point.close })),
          buyPrices: buyResponse.prices.map((point) => ({ date: point.date, close: point.close })),
          source: combineSource(sellResponse.source, buyResponse.source),
          warnings: [
            ...sellResponse.warnings.map((w) => `${sellResponse.normalizedTicker}: ${w}`),
            ...buyResponse.warnings.map((w) => `${buyResponse.normalizedTicker}: ${w}`),
            ...(sellResponse.source !== buyResponse.source
              ? [`Mixed quote sources: ${sellResponse.normalizedTicker}=${sellResponse.source}, ${buyResponse.normalizedTicker}=${buyResponse.source}.`]
              : []),
          ],
          updatedAt: latestUpdatedAt([sellResponse.updatedAt, buyResponse.updatedAt]),
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setQuoteState({
          sellPrices: [],
          buyPrices: [],
          source: "sample",
          warnings: [`Quote history request failed; sample fallback was used: ${error instanceof Error ? error.message : String(error)}`],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistories();
    return () => { cancelled = true; };
  }, [submitted]);

  const result = useMemo(
    () =>
      calculateConversion(
        submitted,
        { sellPrices: quoteState.sellPrices, buyPrices: quoteState.buyPrices },
        { source: quoteState.source, warnings: quoteState.warnings, updatedAt: quoteState.updatedAt },
      ),
    [quoteState.buyPrices, quoteState.sellPrices, quoteState.source, quoteState.updatedAt, quoteState.warnings, submitted],
  );
  const update = <K extends keyof ConversionInput>(key: K, value: ConversionInput[K]) => onChange({ ...input, [key]: value });
  const conversionSortType = detailSort ? conversionColumns.find((column) => column.key === detailSort.key)?.type ?? "string" : "string";
  const sortedRows = useMemo(() => sortRows(result.rows, detailSort?.key, detailSort?.direction ?? "asc", conversionSortType, (row, key) => row[key]), [conversionSortType, detailSort, result.rows]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      {/* Input form */}
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">입력값</h2>
            <CalculatorDataStatus source={result.source} loading={loading} updatedAt={result.updatedAt} loadingText="loading history" />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSubmitted({ ...input })}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-lg border border-[#2a3336] bg-[#151a1b] px-3 py-2 text-[13px] font-semibold text-slate-300 transition-colors hover:bg-[#1c2223] disabled:opacity-50"
            >
              캐시 초기화
            </button>
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
              <Search className="h-4 w-4" />
              분석 실행
            </button>
          </div>
        </div>
        {/* 원본 Streamlit 매도전환 분석의 입력항목만 노출한다 (#7-2). */}
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="매도 티커 (Sell)" value={input.sellTicker} onChange={(v) => update("sellTicker", v.toUpperCase())} />
          <TextInput label="매수 티커 (Buy)" value={input.buyTicker} onChange={(v) => update("buyTicker", v.toUpperCase())} />
          <DateInput label="시작일" value={input.startDate} onChange={(v) => update("startDate", v)} />
          <DateInput label="종료일" value={input.endDate} onChange={(v) => update("endDate", v)} />
        </div>
        <p className="mt-3 rounded-lg border border-[#2a3336] bg-[#151a1b] px-3 py-2 text-[12px] text-slate-400">
          두 종목의 공통 거래일 기준으로 전환비를 분석합니다.
          {result.sellFirstDate && result.buyFirstDate
            ? ` 공통 시작일 자동 추천: ${result.usedStartDate} ~ ${result.usedEndDate}.`
            : " 가능한 가장 이른 공통 시작일을 자동으로 사용합니다."}
        </p>
      </form>

      {/* Warnings */}
      <CalculatorWarningPanel warnings={result.warnings} error={quoteState.error} />

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="현재 전환비" value={`${result.currentRatio}x`} sub={`${submitted.sellTicker} 1주 → ${submitted.buyTicker} ${result.currentRatio}주`} tone="blue" />
        <MetricCard label="기간 평균 전환비" value={`${result.averageRatio}x`} sub={`${result.usedStartDate}~${result.usedEndDate} 중 최근 ${submitted.averageMonths}개월 평균`} tone="gray" />
        <MetricCard label="평균 대비 괴리율" value={`${result.deviationPct}%`} sub={result.judgment} tone={result.deviationPct >= 0 ? "green" : "orange"} />
        <MetricCard label="매수 가능 수량" value={`${result.buyableShares.toLocaleString()}주`} sub={`순매도금 $${result.netSellAmount.toLocaleString()}`} tone="orange" />
      </div>

      {/* Chart */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">전환비 추이</h2>
        <div className="h-[300px] min-w-0 sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.rows} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} minTickGap={32} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336", fontSize: 12 }} />
              <ReferenceLine y={result.averageRatio} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "평균", fill: "#f59e0b", fontSize: 11 }} />
              <Line type="monotone" dataKey="ratio" name="전환비" stroke="#60a5fa" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="averageRatio" name="평균선" stroke="#f59e0b" strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {result.warning && <p className="mt-3 text-[12px] text-slate-500">{result.warning}</p>}
      </div>

      {/* Table */}
      <div className={panel}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-white">전환비 상세 표</h2>
          <TableCsvMenu filename={`sell-conversion-results-${submitted.sellTicker}-to-${submitted.buyTicker}-${today}.csv`} rows={sortedRows} columns={conversionColumns.map((column) => ({ header: column.label, value: (row: ConversionRow) => row[column.key] }))} />
        </div>
        <div className="-mx-5 max-h-[520px] min-w-0 overflow-auto px-5">
          <table className="w-full min-w-[700px] text-left text-[12.5px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                {conversionColumns.map((column) => (
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
                <tr key={row.date} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.date}</td>
                  <td>${row.sellPrice}</td>
                  <td>${row.buyPrice}</td>
                  <td>{row.ratio}x</td>
                  <td>{row.averageRatio}x</td>
                  <td>{row.deviationPct}%</td>
                  <td className={row.signal === "전환 우위" ? "text-green-400" : row.signal === "대기" ? "text-red-400" : "text-slate-300"}>{row.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 rounded-xl border border-[#2a3336] bg-[#151a1b] p-4 text-[12.5px] text-slate-300">
          {result.judgment} 잔여 현금은 약 ${result.leftoverCash.toLocaleString()}입니다.
        </p>
      </div>
    </div>
  );
}
