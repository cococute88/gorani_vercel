"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { PerformanceQldResult } from "@/lib/performance-qld-from-snapshots";

const won = (v: number) => `${Math.round(v).toLocaleString("ko-KR")}원`;
const moneyOrDash = (v: number | null) => (v === null ? "—" : won(v));
const pctOrDash = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const toneCls = (v: number | null) =>
  v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-400" : "text-rose-400";

// 스크린샷 1 왼쪽 카드: 총 평가금액 + 자산 구성 stacked bar + 종목별 보유 목록
export default function QldAssetSummaryCard({ data }: { data: PerformanceQldResult }) {
  const { summary, rankings, flags } = data;
  const totalWeight = rankings.reduce((acc, h) => acc + (h.weightPct ?? 0), 0);
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
        <div className="text-[13px] font-medium text-slate-400">총 평가금액</div>
        <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
          스냅샷 기반
        </span>
      </div>
      <div className="num mt-1 break-keep text-[26px] font-extrabold leading-none tracking-tight text-white sm:text-[34px]">
        {moneyOrDash(summary.evaluationKRW)}
      </div>
      <div className="mt-1 text-[11.5px] text-slate-500">
        {summary.latestSnapshotDate ? `${summary.latestSnapshotDate} 최신 스냅샷` : "저장된 스냅샷 없음"}
        {summary.evaluationSource === "totalAssetKRW" && " · investmentValueKRW 없음, totalAssetKRW 사용"}
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

      <div className="mt-5">
        <div className="mb-2 text-[12.5px] font-medium text-slate-400">자산 구성</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#1b2030]">
          {rankings.length > 0 && totalWeight > 0 ? (
            rankings.map((h) => {
              const barStyle = { width: `${((h.weightPct ?? 0) / totalWeight) * 100}%`, backgroundColor: h.color };
              return <div key={h.ticker} style={barStyle} title={`${h.ticker} ${(h.weightPct ?? 0).toFixed(2)}%`} />;
            })
          ) : (
            <div className="h-full w-full bg-[#242938]" />
          )}
        </div>
      </div>

      <div className="mt-4 flex-1 space-y-0.5">
        {!flags.hasHoldings && (
          <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-3 py-4 text-center text-[12.5px] text-slate-500">
            최신 스냅샷에 보유종목이 없어 자산 구성과 랭킹을 표시할 수 없습니다.
          </div>
        )}
        {flags.hasHoldings && rankings.length === 0 && (
          <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-3 py-4 text-center text-[12.5px] text-slate-500">
            보유종목의 평가금액 필드가 없어 자산 구성 랭킹을 만들 수 없습니다.
          </div>
        )}
        {rankings.map((h) => {
          const dotStyle = { backgroundColor: h.color };
          return (
            <div
              key={h.ticker}
              className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-white/[0.03]"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={dotStyle} />
              <span className="max-w-[92px] shrink-0 truncate text-[13px] font-bold text-slate-100">{h.ticker}</span>
              <span className="flex-1 truncate text-[12px] text-slate-500">{h.name}</span>
              <span className="num shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-300">
                {h.weightPct === null ? "—" : `${h.weightPct.toFixed(1)}%`}
              </span>
              <span className="num w-[96px] shrink-0 text-right text-[13px] font-semibold tabular-nums text-slate-200 sm:w-[110px]">
                {moneyOrDash(h.valueKRW)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
