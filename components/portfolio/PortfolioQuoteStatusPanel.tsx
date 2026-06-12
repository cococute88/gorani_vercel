"use client";

import { useEffect, useMemo, useState } from "react";
import type { Holding } from "@/lib/portfolio-types";
import {
  fetchPortfolioQuoteStatuses,
  getUniqueQuoteTickers,
  type PortfolioQuoteSummary,
} from "@/lib/portfolio-live-quotes";

interface Props {
  holdings: Holding[];
}

function formatPrice(value: number | null): string {
  if (value === null) return "n/a";
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function PortfolioQuoteStatusPanel({ holdings }: Props) {
  const tickers = useMemo(() => getUniqueQuoteTickers(holdings), [holdings]);
  const tickerKey = tickers.join("|");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<PortfolioQuoteSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (tickers.length === 0) {
      setSummary(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchPortfolioQuoteStatuses(holdings)
      .then((next) => {
        if (!cancelled) setSummary(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tickerKey, holdings, tickers.length]);

  if (holdings.length === 0) return null;

  if (tickers.length === 0) {
    return (
      <div className="mb-4 rounded-xl border border-slate-700/60 bg-[#171d1e] px-4 py-2 text-[12.5px] text-slate-400">
        Quote status: no eligible US ticker found. Snapshot values are unchanged.
      </div>
    );
  }

  const statuses = summary?.statuses ?? [];
  const shown = statuses.slice(0, 6);
  const extraCount = Math.max(0, statuses.length - shown.length);
  const warningCount =
    (summary?.warnings.length ?? 0) + statuses.reduce((sum, status) => sum + status.warnings.length, 0);

  return (
    <div className="mb-4 rounded-xl border border-slate-700/60 bg-[#171d1e] px-4 py-2 text-[12.5px] text-slate-400">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold text-slate-300">Quote status</span>
        <span>{loading ? "loading..." : `${tickers.length} ticker(s)`}</span>
        {shown.map((status) => (
          <span key={status.ticker} className="num text-slate-300">
            {status.ticker} {formatPrice(status.price)} {status.source}
          </span>
        ))}
        {extraCount > 0 && <span>+{extraCount} more</span>}
      </div>
      <div className="mt-1 text-[11.5px] text-slate-500">
        Latest prices are reference-only. Snapshot valuation is preserved because uploaded rows may not include quantity.
        {warningCount > 0 ? ` ${warningCount} warning(s).` : ""}
      </div>
    </div>
  );
}
