"use client";

import { ACCOUNT_CARDS } from "@/lib/mockData";
import { formatWon, formatWonSigned, formatPercent } from "@/lib/format";
import { usePortfolioView } from "@/lib/use-portfolio-view";

import type { LiveAccountCard } from "@/lib/portfolio-aggregate";

type Props = { theme?: "dark" | "light" };

// 하단 계좌 카드 grid (다크에서는 제목 패널 래핑 + 조밀한 카드).
export default function AssetAccountCards({ theme = "light" }: Props) {
  const { hasLiveData, accountCards } = usePortfolioView();
  const cards: LiveAccountCard[] = hasLiveData
    ? accountCards
    : ACCOUNT_CARDS.map((card) => ({
        ...card,
        statusGroup: card.type,
        holdingCount: 0,
      }));
  const isLight = theme === "light";
  const cardCls = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#171c1d] border border-[#2a3336]";
  const nameCls = isLight ? "text-slate-800" : "text-slate-100";
  const labelCls = isLight ? "text-slate-400" : "text-slate-500";
  const valueCls = isLight ? "text-slate-900" : "text-slate-100";

  const grid = (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
      {cards.map((a) => {
        const profitStyle = { color: a.profit >= 0 ? "#e5484d" : "#3b82f6" };
        const taxCls =
          a.tax === "비과세"
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-slate-500/15 text-slate-400";
        return (
          <div key={a.name} className={`rounded-xl p-3 ${cardCls}`}>
            <div className="mb-1.5 flex items-center justify-between gap-1">
              <span className={`truncate text-[12.5px] font-bold ${nameCls}`}>
                {a.name}
              </span>
              <span
                className={`shrink-0 rounded px-1 py-0.5 text-[9.5px] font-medium ${taxCls}`}
              >
                {hasLiveData ? a.statusGroup : a.tax}
              </span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10.5px] ${labelCls}`}>평가</span>
                <span className={`num text-[12.5px] font-bold ${valueCls}`}>
                  {formatWon(a.value)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10.5px] ${labelCls}`}>수익</span>
                <span
                  className="num text-[11.5px] font-semibold"
                  style={profitStyle}
                >
                  {a.profit === 0 ? "-" : formatWonSigned(a.profit)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-[10.5px] ${labelCls}`}>수익률</span>
                <span
                  className="num text-[11.5px] font-semibold"
                  style={profitStyle}
                >
                  {a.rate === 0 ? "-" : formatPercent(a.rate)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (isLight) return grid;

  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <div className="mb-2.5 flex items-center justify-between gap-2 text-[14px] font-bold text-slate-200">
        <span>계좌 현황</span>
        {hasLiveData && <span className="text-[11px] font-medium text-emerald-300">④현황 기준</span>}
      </div>
      {grid}
    </div>
  );
}
