"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput, NumberInput, DateInput, SelectInput } from "./CalculatorInputField";
import { fetchQuoteHistory } from "@/lib/calculator-data-provider";
import { calculateConversion } from "@/lib/conversion-calculator";
import type { ConversionInput, ConversionPricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

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

  return (
    <div className="space-y-4">
      {/* Input form */}
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">입력값</h2>
            <CalculatorDataStatus source={result.source} loading={loading} updatedAt={result.updatedAt} loadingText="loading history" />
          </div>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
            <Search className="h-4 w-4" />
            계산 실행
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          <TextInput label="매도 티커" value={input.sellTicker} onChange={(v) => update("sellTicker", v.toUpperCase())} />
          <TextInput label="매수 티커" value={input.buyTicker} onChange={(v) => update("buyTicker", v.toUpperCase())} />
          <NumberInput label="보유/매도 수량" value={input.sellShares} onChange={(v) => update("sellShares", v)} />
          <NumberInput label="매도 현재가($)" value={input.sellPrice} onChange={(v) => update("sellPrice", v)} />
          <NumberInput label="매수 현재가($)" value={input.buyPrice} onChange={(v) => update("buyPrice", v)} />
          <DateInput label="시작일" value={input.startDate} onChange={(v) => update("startDate", v)} />
          <DateInput label="종료일" value={input.endDate} onChange={(v) => update("endDate", v)} />
          <NumberInput label="평균 산출 기간(개월)" value={input.averageMonths} onChange={(v) => update("averageMonths", v)} />
          <NumberInput label="전환 기준 괴리율(%)" value={input.thresholdPct} onChange={(v) => update("thresholdPct", v)} />
          <NumberInput label="매도 수수료(%)" value={input.sellFeeRate} onChange={(v) => update("sellFeeRate", v)} />
          <NumberInput label="매수 수수료(%)" value={input.buyFeeRate} onChange={(v) => update("buyFeeRate", v)} />
        </div>
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
        <h2 className="mb-4 text-[15px] font-bold text-white">전환비 상세 표</h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[700px] text-left text-[12.5px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">일자</th>
                <th>매도 가격</th>
                <th>매수 가격</th>
                <th>전환비</th>
                <th>평균 전환비</th>
                <th>괴리율</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
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
