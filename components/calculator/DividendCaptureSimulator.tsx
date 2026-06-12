"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import MetricCard from "@/components/MetricCard";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput, NumberInput, SelectInput } from "./CalculatorInputField";
import { fetchQuoteDividends, fetchQuoteHistory } from "@/lib/calculator-data-provider";
import { resolveDividendCaptureDates, simulateDividendCapture } from "@/lib/dividend-capture-calculator";
import type { DividendCaptureDividendPoint, DividendCaptureInput, DividendCapturePricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

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

function toQuoteRequest(input: DividendCaptureInput) {
  const { start, end } = resolveDividendCaptureDates(input);
  if (input.recent5yOnly) return { ticker: input.ticker, range: "5y", end };
  return { ticker: input.ticker, start, end };
}

export default function DividendCaptureSimulator({ input, onChange }: { input: DividendCaptureInput; onChange: (input: DividendCaptureInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const [quoteState, setQuoteState] = useState<DividendCaptureQuoteState>({ warnings: [] });
  const [loading, setLoading] = useState(false);

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
            계산 실행
          </button>
        </div>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="티커" value={input.ticker} onChange={(v) => update("ticker", v.toUpperCase())} />
          <NumberInput label="투자금($)" value={input.investmentAmount} onChange={(v) => update("investmentAmount", v)} />
          <SelectInput label="매수가 기준" value={input.buyType} onChange={(v) => update("buyType", v as DividendCaptureInput["buyType"])}>
            <option value="D-1 종가">D-1 종가</option>
            <option value="D-1 시가">D-1 시가</option>
            <option value="D-2 종가">D-2 종가</option>
            <option value="D-2 시가">D-2 시가</option>
          </SelectInput>
          <NumberInput label="매도허용기간(N거래일)" value={input.sellWindow} onChange={(v) => update("sellWindow", v)} />
          <NumberInput label="기준 매수가($)" value={input.referenceBuyPrice} onChange={(v) => update("referenceBuyPrice", v)} />
          <NumberInput label="배당락 기준가($)" value={input.referenceExOpenPrice} onChange={(v) => update("referenceExOpenPrice", v)} />
          <NumberInput label="주당 배당($)" value={input.dividendPerShare} onChange={(v) => update("dividendPerShare", v)} />
          <NumberInput label="세율(%)" value={input.taxRate} onChange={(v) => update("taxRate", v)} />
          <NumberInput label="수수료(%)" value={input.commissionRate} onChange={(v) => update("commissionRate", v)} />
          <NumberInput label="슬리피지(%)" value={input.slippageRate} onChange={(v) => update("slippageRate", v)} />
          <NumberInput label="분석 기간(개월)" value={input.analysisMonths} onChange={(v) => update("analysisMonths", v)} />
          <SelectInput label="최근 5년 데이터만 보기" value={input.recent5yOnly ? "true" : "false"} onChange={(v) => update("recent5yOnly", v === "true")}>
            <option value="false">아니오</option>
            <option value="true">예</option>
          </SelectInput>
        </div>
      </form>

      {/* Warnings */}
      <CalculatorWarningPanel warnings={result.warnings} error={quoteState.error} />

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="매수 가능 수량" value={`${result.shares.toLocaleString()}주`} sub={`${submitted.ticker} 기준`} tone="blue" />
        <MetricCard label="세후 배당금" value={`$${result.netDividend.toLocaleString()}`} sub={`세율 ${submitted.taxRate}% 반영`} tone="green" />
        <MetricCard label="예상 가격 하락" value={`-$${result.expectedDrop.toLocaleString()}`} sub="매수가 - 배당락 저가" tone="orange" />
        <MetricCard label="손익분기 가격" value={`$${result.breakevenPrice.toLocaleString()}`} sub="세후 배당·비용 반영" tone="blue" />
        <MetricCard label="성공률" value={`${result.successRate}%`} sub={`${result.rows.length}회 분석`} tone="green" />
        <MetricCard label="평균 회복일" value={`${result.averageRecoveryDays}일`} sub={`평균 수익률 ${result.averageProfitPct}%`} tone="gray" />
      </div>

      {/* Chart */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">성공/실패 분포</h2>
        <div className="h-[280px] min-w-0 sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="recoveryDays" name="회복일" unit="일" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis dataKey="profitPct" name="수익률" unit="%" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#111516", border: "1px solid #2a3336", fontSize: 12 }} />
              <Scatter data={result.rows} name="회차">
                {result.rows.map((entry) => <Cell key={entry.exDate} fill={entry.result === "성공" ? "#22c55e" : "#ef4444"} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {result.warning && <p className="mt-3 text-[12px] text-slate-500">{result.warning}</p>}
      </div>

      {/* Detail table */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">회차별 상세 결과</h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[900px] text-left text-[12px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">회차</th>
                <th>배당락일</th>
                <th>매수가</th>
                <th>손익분기</th>
                <th>최고가</th>
                <th>매도가</th>
                <th>세후 배당</th>
                <th>가격손익</th>
                <th>총손익</th>
                <th>수익률</th>
                <th>회복일</th>
                <th>거래일</th>
                <th>달력일</th>
                <th>결과</th>
                <th>판정</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => (
                <tr key={row.exDate} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.round}</td>
                  <td>{row.exDate}</td>
                  <td>${row.buyPrice}</td>
                  <td>${row.breakevenPrice}</td>
                  <td>${row.maxHigh}</td>
                  <td>${row.sellPrice}</td>
                  <td>${row.netDividend}</td>
                  <td>${row.pricePnL}</td>
                  <td>${row.totalPnL}</td>
                  <td>{row.profitPct}%</td>
                  <td>{row.recoveryDate}</td>
                  <td>{row.recoveryTradingDays}</td>
                  <td>{row.recoveryCalendarDays}</td>
                  <td className={row.result === "성공" ? "text-green-400" : "text-red-400"}>{row.result}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
