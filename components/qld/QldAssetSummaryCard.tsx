"use client";

import { ArrowUp } from "lucide-react";
import { QLD_HOLDINGS, QLD_SUMMARY } from "@/lib/qldDashboardData";

const won = (v: number) => v.toLocaleString("ko-KR");

// 스크린샷 1 왼쪽 카드: 총 평가금액 + 자산 구성 stacked bar + 종목별 보유 목록
export default function QldAssetSummaryCard() {
  const s = QLD_SUMMARY;
  const totalWeight = QLD_HOLDINGS.reduce((acc, h) => acc + h.weight, 0);

  return (
    <div className="flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="text-[13px] font-medium text-slate-400">총 평가금액</div>
      <div className="num mt-1 text-[34px] font-extrabold leading-none tracking-tight text-white">
        {won(s.totalValue)}
      </div>

      <div className="mt-3">
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[12.5px] font-semibold text-emerald-400">
          <ArrowUp size={13} strokeWidth={2.5} />
          <span className="num">
            전일 {won(s.dayChange)}원 (+{s.dayChangeRate.toFixed(2)}%)
          </span>
        </span>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[12.5px] font-medium text-slate-400">자산 구성</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#1b2030]">
          {QLD_HOLDINGS.map((h) => {
            const barStyle = { width: `${(h.weight / totalWeight) * 100}%`, backgroundColor: h.color };
            return <div key={h.ticker} style={barStyle} title={`${h.ticker} ${h.weight}%`} />;
          })}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-0.5">
        {QLD_HOLDINGS.map((h) => {
          const dotStyle = { backgroundColor: h.color };
          return (
            <div
              key={h.ticker}
              className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle} />
              <span className="shrink-0 text-[13px] font-bold text-slate-100">{h.ticker}</span>
              <span className="flex-1 truncate text-[12px] text-slate-500">{h.name}</span>
              <span className="num shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-300">
                {h.weight.toFixed(1)}%
              </span>
              <span className="num w-[110px] shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-200">
                {won(h.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
