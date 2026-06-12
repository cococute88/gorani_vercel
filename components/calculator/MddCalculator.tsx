"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "@/components/MetricCard";
import CalculatorDataStatus from "./CalculatorDataStatus";
import CalculatorWarningPanel from "./CalculatorWarningPanel";
import { TextInput, NumberInput, DateInput, SelectInput } from "./CalculatorInputField";
import { fetchQuoteHistory } from "@/lib/calculator-data-provider";
import { calculateMdd } from "@/lib/mdd-calculator";
import type { MddInput, PricePoint } from "@/lib/calculator-types";
import type { QuoteSource } from "@/lib/quote-types";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

type MddQuoteState = {
  prices?: PricePoint[];
  source?: QuoteSource;
  warnings: string[];
  updatedAt?: string;
  error?: string | null;
};

function toHistoryRequest(input: MddInput) {
  if (input.analysisPeriod === "custom") {
    return { ticker: input.ticker, start: input.startDate, end: input.endDate };
  }
  return { ticker: input.ticker, range: input.analysisPeriod, end: input.endDate };
}

function formatMoney(value: number, currency: MddInput["currency"]) {
  const prefix = currency === "USD" ? "$" : "KRW ";
  return `${prefix}${value.toLocaleString()}`;
}

export default function MddCalculator({ input, onChange }: { input: MddInput; onChange: (input: MddInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const [quoteState, setQuoteState] = useState<MddQuoteState>({ warnings: [] });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setQuoteState((previous) => ({ ...previous, error: null }));

      try {
        const response = await fetchQuoteHistory(toHistoryRequest(submitted));
        if (cancelled) return;

        setQuoteState({
          prices: response.prices.map((point) => ({ date: point.date, close: point.close })),
          source: response.source,
          warnings: response.warnings,
          updatedAt: response.updatedAt,
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setQuoteState({
          prices: [],
          source: "sample",
          warnings: [`Quote history request failed; sample fallback was used: ${error instanceof Error ? error.message : String(error)}`],
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadHistory();
    return () => { cancelled = true; };
  }, [submitted]);

  const result = useMemo(
    () =>
      calculateMdd(submitted, quoteState.prices, {
        source: quoteState.source,
        warnings: quoteState.warnings,
        updatedAt: quoteState.updatedAt,
      }),
    [quoteState.prices, quoteState.source, quoteState.updatedAt, quoteState.warnings, submitted],
  );

  const update = <K extends keyof MddInput>(key: K, value: MddInput[K]) => onChange({ ...input, [key]: value });
  const displayWarnings = [
    ...result.warnings,
    ...(submitted.currency === "KRW" ? ["KRW option is preserved, but Step 4A calculates MDD from USD close prices only."] : []),
  ];

  return (
    <div className="space-y-4">
      {/* Input form */}
      <form
        className={panel}
        onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">MDD inputs</h2>
            <CalculatorDataStatus source={result.source} loading={loading} updatedAt={result.updatedAt} loadingText="loading history" />
          </div>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">
            <Search className="h-4 w-4" />
            Calculate
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Ticker" value={input.ticker} onChange={(v) => update("ticker", v.toUpperCase())} />
          <SelectInput label="Period" value={input.analysisPeriod} onChange={(v) => update("analysisPeriod", v as MddInput["analysisPeriod"])}>
            <option value="6m">6 months</option>
            <option value="1y">1 year</option>
            <option value="3y">3 years</option>
            <option value="5y">5 years</option>
            <option value="custom">Custom</option>
          </SelectInput>
          <DateInput label="Start date" value={input.startDate} onChange={(v) => update("startDate", v)} />
          <DateInput label="End date" value={input.endDate} onChange={(v) => update("endDate", v)} />
          <SelectInput label="Currency" value={input.currency} onChange={(v) => update("currency", v as MddInput["currency"])}>
            <option value="USD">USD</option>
            <option value="KRW">KRW</option>
          </SelectInput>
          <NumberInput label="Initial amount" value={input.initialAmount} onChange={(v) => update("initialAmount", v)} />
          <NumberInput label="Sample current price" value={input.currentPrice} onChange={(v) => update("currentPrice", v)} />
          <NumberInput label="Sample high price" value={input.highPrice} onChange={(v) => update("highPrice", v)} />
          <NumberInput label="Sample low price" value={input.lowPrice} onChange={(v) => update("lowPrice", v)} />
        </div>
      </form>

      {/* Warnings */}
      <CalculatorWarningPanel warnings={displayWarnings} error={quoteState.error} />

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Latest price" value={formatMoney(result.currentPrice, submitted.currency)} sub={`${submitted.ticker.toUpperCase()} ${result.source} data`} tone="blue" />
        <MetricCard label="Period high" value={result.peakPrice.toLocaleString()} sub={result.highDate} tone="green" />
        <MetricCard label="Current drawdown" value={`${result.currentDrawdown}%`} sub="vs running high" tone="orange" />
        <MetricCard label="Max drawdown" value={`${result.maxDrawdown}%`} sub={`${result.highDate} to ${result.lowDate}`} tone="gray" />
        <MetricCard label="Trough date" value={result.lowDate} sub="MDD low point" tone="orange" />
        <MetricCard label="Recovery date" value={result.recoveryDate ?? "Unrecovered"} sub={result.recoveryDays ? `${result.recoveryDays} days` : "Peak not recovered"} tone="blue" />
      </div>

      {/* Chart */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Drawdown chart</h2>
        <div className="h-[300px] min-w-0 sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.series} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 11 }} minTickGap={32} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} unit="%" />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336", fontSize: 12 }} />
              <ReferenceLine y={-10} stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine y={-20} stroke="#fb923c" strokeDasharray="4 4" />
              <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={-40} stroke="#991b1b" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="#f97316" fill="#f97316" fillOpacity={0.24} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* MDD segments table */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">MDD segments</h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[700px] text-left text-[12.5px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">Period</th>
                <th>Peak date</th>
                <th>Trough date</th>
                <th>MDD</th>
                <th>Recovery date</th>
                <th>Recovery days</th>
              </tr>
            </thead>
            <tbody>
              {result.segments.map((row) => (
                <tr key={`${row.highDate}-${row.lowDate}`} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.period}</td>
                  <td>{row.highDate}</td>
                  <td>{row.lowDate}</td>
                  <td className="text-red-300">{row.mdd}%</td>
                  <td>{row.recoveryDate ?? "Unrecovered"}</td>
                  <td>{row.recoveryDays ? `${row.recoveryDays} days` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent price table */}
      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Recent price and drawdown</h2>
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-[600px] text-left text-[12.5px]">
            <thead className="text-slate-500">
              <tr className="border-b border-[#2a3336]">
                <th className="py-2">Date</th>
                <th>Close</th>
                <th>Running high</th>
                <th>Drawdown</th>
                <th>Indexed value</th>
              </tr>
            </thead>
            <tbody>
              {result.series.slice(-16).map((row) => (
                <tr key={row.date} className="border-b border-[#222a2c] text-slate-300 last:border-0">
                  <td className="py-2 font-semibold text-white">{row.date}</td>
                  <td>{row.close}</td>
                  <td>{row.peak}</td>
                  <td className="text-orange-300">{row.drawdown}%</td>
                  <td>{row.value.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
