"use client";

import { useEffect, useMemo, useState } from "react";
import type { Holding } from "@/lib/portfolio-types";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
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
  const isLight = useResolvedTheme() === "light";
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

  // 실시간 시세를 조회할 미국 종목이 없으면 안내 가치가 없으므로 패널 자체를 숨긴다.
  if (holdings.length === 0 || tickers.length === 0) return null;

  const panelCls = isLight
    ? "border-slate-200 bg-slate-50 text-slate-500"
    : "border-[#2a3336] bg-white/[0.03] text-slate-400";
  const strongCls = isLight ? "text-slate-700" : "text-slate-300";
  const subCls = isLight ? "text-slate-400" : "text-slate-500";

  const statuses = summary?.statuses ?? [];
  const shown = statuses.slice(0, 6);
  const extraCount = Math.max(0, statuses.length - shown.length);
  const warningCount =
    (summary?.warnings.length ?? 0) + statuses.reduce((sum, status) => sum + status.warnings.length, 0);

  return (
    <div className={`mb-4 rounded-xl border px-4 py-2 text-[12.5px] ${panelCls}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`font-semibold ${strongCls}`}>실시간 시세 (참고용)</span>
        <span>{loading ? "불러오는 중…" : `미국 종목 ${tickers.length}개`}</span>
        {shown.map((status) => (
          <span key={status.ticker} className={`num ${strongCls}`}>
            {status.ticker} {formatPrice(status.price)}
          </span>
        ))}
        {extraCount > 0 && <span>외 {extraCount}개</span>}
      </div>
      <div className={`mt-1 text-[11.5px] ${subCls}`}>
        시세는 참고용이며, 평가금액은 등록한 스냅샷 기준으로 유지됩니다.
        {warningCount > 0 ? " 일부 종목 시세는 불러오지 못했습니다." : ""}
      </div>
    </div>
  );
}
