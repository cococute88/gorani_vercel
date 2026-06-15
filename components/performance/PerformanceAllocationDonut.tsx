"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCompactKrw } from "@/lib/format";
import type { PerformanceAssetGroupResult } from "@/lib/performance-asset-group";

// 스트림릿 스타일 자산 구성 도넛 + 하단 상세 범례.
// 정규화 종목군(TQQQ/QLD/QQQ/SPY/SCHD/MSFT/달러/현금/예적금/기타) 단위로 합산된
// PerformanceAssetGroupResult 를 받아 비중/수익률/금액을 함께 표시한다.
// (이 카드는 항상 다크 톤으로 렌더된다 — 부모 QldAssetSummaryCard 와 동일.)

const SIZE = 148;
const INNER = Math.round((SIZE * 0.62) / 2);
const OUTER = Math.round(SIZE / 2);

function weightLabel(value: number): string {
  return `${value.toFixed(1)}%`;
}

function returnLabel(value: number | null): string {
  if (value === null) return "(-)";
  const sign = value > 0 ? "+" : "";
  return `(${sign}${value.toFixed(1)}%)`;
}

function returnTone(value: number | null): string {
  if (value === null || value === 0) return "text-slate-400";
  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

export default function PerformanceAllocationDonut({
  data,
  emptyMessage = "보유종목의 평가금액 필드가 없어 자산 구성을 표시할 수 없습니다.",
}: {
  data: PerformanceAssetGroupResult;
  emptyMessage?: string;
}) {
  const { groups, totalKRW } = data;
  const hasData = groups.length > 0 && totalKRW > 0;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-medium text-slate-400">자산 구성</span>
        {hasData && (
          <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
            종목군 합산
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-3 py-6 text-center text-[12.5px] text-slate-500">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          {/* 도넛 (중앙이 뚫린 형태) */}
          <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={groups}
                  dataKey="valueKRW"
                  nameKey="label"
                  innerRadius={INNER}
                  outerRadius={OUTER}
                  paddingAngle={1}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                >
                  {groups.map((g) => (
                    <Cell key={g.key} fill={g.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10.5px] text-slate-500">총 평가</span>
              <span className="num text-[13px] font-bold text-slate-100">
                {formatCompactKrw(totalKRW)}
              </span>
            </div>
          </div>

          {/* 하단(가로폭 좁으면 옆) 상세 범례: 종목군 / 비중 / 수익률 / 금액 */}
          <ul className="w-full min-w-0 flex-1 space-y-0.5">
            {groups.map((g) => (
              <li
                key={g.key}
                className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-white/[0.03]"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <span className="w-[52px] shrink-0 truncate text-[12.5px] font-bold text-slate-100">
                  {g.label}
                </span>
                <span className="num w-[46px] shrink-0 text-right text-[11.5px] font-semibold text-slate-300">
                  {weightLabel(g.weightPct)}
                </span>
                <span
                  className={`num w-[64px] shrink-0 text-right text-[11px] font-medium ${returnTone(g.returnPct)}`}
                >
                  {returnLabel(g.returnPct)}
                </span>
                <span className="num flex-1 truncate text-right text-[12.5px] font-semibold tabular-nums text-slate-200">
                  {formatCompactKrw(g.valueKRW)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
