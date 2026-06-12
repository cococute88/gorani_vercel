"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import MetricCard from "@/components/MetricCard";
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
    return {
      ticker: input.ticker,
      start: input.startDate,
      end: input.endDate,
    };
  }

  return {
    ticker: input.ticker,
    range: input.analysisPeriod,
    end: input.endDate,
  };
}

function sourceLabel(source?: QuoteSource) {
  if (!source) return "loading";
  return source.toUpperCase();
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

    return () => {
      cancelled = true;
    };
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
    <div className="space-y-5">
      <form
        className={panel}
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(input);
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-white">MDD inputs</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-400">
              <span className={`rounded-full border px-2 py-1 font-bold ${result.source === "sample" ? "border-amber-500/50 text-amber-200" : "border-blue-500/40 text-blue-200"}`}>
                source: {sourceLabel(result.source)}
              </span>
              {loading && (
                <span className="inline-flex items-center gap-1 text-blue-200">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  loading history
                </span>
              )}
              {result.updatedAt && <span>updated: {new Date(result.updatedAt).toLocaleString()}</span>}
            </div>
          </div>
          <button type="submit" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700">
            <Search className="h-4 w-4" />
            Calculate
          </button>
        </div>

        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="Ticker" value={input.ticker} onChange={(value) => update("ticker", value.toUpperCase())} />
          <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
            <span className="text-[12px] text-slate-500">Period</span>
            <select value={input.analysisPeriod} onChange={(event) => update("analysisPeriod", event.target.value as MddInput["analysisPeriod"])} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none">
              <option value="6m">6 months</option>
              <option value="1y">1 year</option>
              <option value="3y">3 years</option>
              <option value="5y">5 years</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          <DateInput label="Start date" value={input.startDate} onChange={(value) => update("startDate", value)} />
          <DateInput label="End date" value={input.endDate} onChange={(value) => update("endDate", value)} />
          <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
            <span className="text-[12px] text-slate-500">Currency</span>
            <select value={input.currency} onChange={(event) => update("currency", event.target.value as MddInput["currency"])} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none">
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
            </select>
          </label>
          <NumberInput label="Initial amount" value={input.initialAmount} onChange={(value) => update("initialAmount", value)} />
          <NumberInput label="Sample current price" value={input.currentPrice} onChange={(value) => update("currentPrice", value)} />
          <NumberInput label="Sample high price" value={input.highPrice} onChange={(value) => update("highPrice", value)} />
          <NumberInput label="Sample low price" value={input.lowPrice} onChange={(value) => update("lowPrice", value)} />
        </div>
      </form>

      {quoteState.error && <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-[13px] text-red-200">{quoteState.error}</div>}

      {displayWarnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 text-[12.5px] text-amber-100">
          <p className="font-bold">Warnings</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {displayWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Latest price" value={formatMoney(result.currentPrice, submitted.currency)} sub={`${submitted.ticker.toUpperCase()} ${result.source} data`} tone="blue" />
        <MetricCard label="Period high" value={result.peakPrice.toLocaleString()} sub={result.highDate} tone="green" />
        <MetricCard label="Current drawdown" value={`${result.currentDrawdown}%`} sub="vs running high" tone="orange" />
        <MetricCard label="Max drawdown" value={`${result.maxDrawdown}%`} sub={`${result.highDate} to ${result.lowDate}`} tone="gray" />
        <MetricCard label="Trough date" value={result.lowDate} sub="MDD low point" tone="orange" />
        <MetricCard label="Recovery date" value={result.recoveryDate ?? "Unrecovered"} sub={result.recoveryDays ? `${result.recoveryDays} days` : "Peak not recovered"} tone="blue" />
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Drawdown chart</h2>
        <div className="h-[340px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={result.series} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} unit="%" />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
              <ReferenceLine y={-10} stroke="#f59e0b" strokeDasharray="4 4" />
              <ReferenceLine y={-20} stroke="#fb923c" strokeDasharray="4 4" />
              <ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="4 4" />
              <ReferenceLine y={-40} stroke="#991b1b" strokeDasharray="4 4" />
              <Area type="monotone" dataKey="drawdown" name="Drawdown" stroke="#f97316" fill="#f97316" fillOpacity={0.24} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">MDD segments</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13px]">
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

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Recent price and drawdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[13px]">
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

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
      <span className="text-[12px] text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" />
    </label>
  );
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
      <span className="text-[12px] text-slate-500">{label}</span>
      <input type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" />
    </label>
  );
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
      <span className="text-[12px] text-slate-500">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" />
    </label>
  );
}
