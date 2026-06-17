"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Maximize2 } from "lucide-react";
import {
  CARD_RANGES,
  fetchIndexQuote,
  formatSignedPct,
  formatSignedUsd,
  formatUpdatedAt,
  formatUsd,
  type IndexDef,
  type IndexQuote,
} from "@/lib/market-index";

// lightweight-charts touches the DOM, so load the sparkline client-only.
const IndexSparkline = dynamic(() => import("./IndexSparkline"), { ssr: false });

interface Props {
  def: IndexDef;
  onOpen: (def: IndexDef, range: string) => void;
}

export default function MarketIndexCard({ def, onOpen }: Props) {
  const [range, setRange] = useState("1y");
  const [quote, setQuote] = useState<IndexQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    fetchIndexQuote(def.symbol, range)
      .then((data) => {
        if (!active) return;
        setQuote(data);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [def.symbol, range]);

  const up = (quote?.change ?? 0) >= 0;
  const changeColor = up ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(def, range)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(def, range);
        }
      }}
      className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 dark:border-[#2a3336] dark:bg-[#191f20] dark:hover:border-blue-500/60"
    >
      {/* Header: name + open hint */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold text-slate-900 dark:text-white">{def.name}</span>
            <span className="text-[11px] font-medium text-slate-400">{def.ticker}</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-400">{def.description}</p>
        </div>
        <Maximize2
          size={15}
          className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-500"
        />
      </div>

      {/* Price + change */}
      <div className="mt-3">
        {error ? (
          <div className="num text-[20px] font-extrabold text-slate-400">조회 불가</div>
        ) : (
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="num text-[26px] font-extrabold leading-none text-slate-900 dark:text-white">
              {quote ? formatUsd(quote.price) : "—"}
            </span>
            <span className={`num text-[13px] font-semibold ${changeColor}`}>
              {quote ? `${formatSignedUsd(quote.change)} (${formatSignedPct(quote.changePct)})` : ""}
            </span>
          </div>
        )}
        <p className="mt-1 text-[11px] text-slate-400">
          {quote?.source === "sample"
            ? "샘플 데이터"
            : quote
              ? `${formatUpdatedAt(quote.updatedAt)} 기준`
              : loading
                ? "불러오는 중…"
                : ""}
        </p>
      </div>

      {/* Sparkline */}
      <div className="mt-2 h-[72px]" onClick={(event) => event.stopPropagation()}>
        {quote && quote.candles.length > 0 ? (
          <IndexSparkline candles={quote.candles} up={up} height={72} />
        ) : (
          <div className="h-full w-full animate-pulse rounded-md bg-slate-100 dark:bg-white/5" />
        )}
      </div>

      {/* Period toggle (does not open the modal) */}
      <div
        className="mt-3 flex items-center gap-0.5 border-t border-slate-100 pt-2 dark:border-white/5"
        onClick={(event) => event.stopPropagation()}
      >
        {CARD_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 rounded-md px-1 py-1 text-[11px] font-semibold transition-colors ${
              range === r.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
