"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { PerformanceQldResult } from "@/lib/performance-qld-from-snapshots";
import PerformanceAllocationDonut from "@/components/performance/PerformanceAllocationDonut";

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const moneyOrDash = (v: number | null) => (v === null ? "—" : won(v));
const pctOrDash = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const toneCls = (v: number | null) =>
  v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-400" : "text-rose-400";

// 투자 성과 왼쪽 카드: 투자 평가금액 + 자산 구성 도넛(정규화 종목군 합산, PERFORMANCE-DONUT-RANKING-1)
// ASSET-CLASS-DONUT-POLISH-2: 이 큰 KPI 는 전체 금융자산 총액이 아니라 스냅샷 투자 평가금액이므로
// /portfolio 의 "총 금융자산" 과 혼동되지 않도록 라벨을 "투자 평가금액" 으로 표기한다.
export default function QldAssetSummaryCard({ data }: { data: PerformanceQldResult }) {
  const { summary, assetGroups, flags } = data;
  const change = summary.previousChangeKRW;
  const changeRate = summary.previousChangePct;
  const ChangeIcon = change === null || change === 0 ? Minus : change > 0 ? ArrowUp : ArrowDown;
  const changeBadgeCls =
    change === null || change === 0
      ? "bg-slate-500/10 text-slate-400"
      : change > 0
        ? "bg-emerald-500/10 text-emerald-400"
        : "bg-rose-500/10 text-rose-400";

  return (
    <div className="flex h-full flex-col rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] font-medium text-slate-400">투자 평가금액</div>
        <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
          스냅샷 기반
        </span>
      </div>
      <div className="num mt-1 break-keep text-[26px] font-extrabold leading-none tracking-tight text-white sm:text-[34px]">
        {moneyOrDash(summary.evaluationKRW)}
      </div>
      <div className="mt-1 text-[11.5px] text-slate-500">
        {summary.latestSnapshotDate ? `${summary.latestSnapshotDate} 최신 스냅샷` : "저장된 스냅샷 없음"}
        {summary.evaluationSource === "totalAssetKRW" && " · 투자 평가금액 대체 기준 사용"}
      </div>

      <div className="mt-3">
        <span className={`inline-flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-semibold ${changeBadgeCls}`}>
          <ChangeIcon size={13} strokeWidth={2.5} />
          <span className="num">
            {summary.previousSnapshotDate
              ? `이전 스냅샷 ${moneyOrDash(change)} (${pctOrDash(changeRate)})`
              : "이전 스냅샷 비교 불가"}
          </span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="min-w-0 rounded-xl border border-[#1f2433] bg-[#0e111a] px-3 py-2">
          <div className="text-[11px] text-slate-500">투자원금</div>
          <div className="num mt-0.5 truncate text-[13px] font-semibold text-slate-100">
            {moneyOrDash(summary.principalKRW)}
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-[#1f2433] bg-[#0e111a] px-3 py-2">
          <div className="text-[11px] text-slate-500">누적 손익</div>
          <div className={`num mt-0.5 truncate text-[13px] font-semibold ${toneCls(summary.profitKRW)}`}>
            {moneyOrDash(summary.profitKRW)}
          </div>
          <div className={`num mt-0.5 text-[10.5px] ${toneCls(summary.returnPct)}`}>
            {pctOrDash(summary.returnPct)}
          </div>
        </div>
      </div>

      <div className="mt-5 flex-1">
        {!flags.hasHoldings ? (
          <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-3 py-4 text-center text-[12.5px] text-slate-500">
            최신 스냅샷에 보유종목이 없어 자산 구성과 랭킹을 표시할 수 없습니다.
          </div>
        ) : (
          <PerformanceAllocationDonut data={assetGroups} />
        )}
      </div>
    </div>
  );
}
