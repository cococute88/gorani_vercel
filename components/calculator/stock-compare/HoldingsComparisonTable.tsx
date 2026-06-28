"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { HoldingRow, OverlapResult } from "@/lib/stock-compare/types";

// =============================================================
// Top Holdings 비교 표: 순위 / 티커A 종목 / 공통 여부 / 비중 / 티커B 종목.
// 기본 Top10, 하단 "전체보기" 토글로 전체 구성종목 표시.
// 모바일에서는 가로 스크롤로 가독성 확보.
// =============================================================

interface Props {
  tickerA: string;
  tickerB: string;
  overlap: OverlapResult;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

function HoldingCell({ row, common }: { row: HoldingRow | null; common: boolean }) {
  if (!row) return <span className="text-slate-300 dark:text-slate-600">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span
        className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${
          common
            ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
            : "bg-slate-100 text-slate-600 dark:bg-[#222a2c] dark:text-slate-300"
        }`}
      >
        {row.ticker}
      </span>
      <span className="truncate text-slate-600 dark:text-slate-300" title={row.name}>
        {row.name}
      </span>
    </div>
  );
}

export default function HoldingsComparisonTable({ tickerA, tickerB, overlap }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (!overlap.hasHoldings) return null;

  const commonSet = new Set(overlap.commonTickers);
  const rows = showAll ? overlap.comparisonRows : overlap.comparisonRows.slice(0, 10);

  return (
    <section className={panel}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">상위 구성종목 비교</h2>
        <span className="text-[12px] text-slate-400">공통 종목은 파란색으로 표시</span>
      </div>

      <div className="-mx-1 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500 dark:border-[#2a3336] dark:text-slate-400">
              <th className="w-10 px-2 py-2 font-semibold">#</th>
              <th className="px-2 py-2 font-semibold">{tickerA}</th>
              <th className="w-16 px-2 py-2 text-right font-semibold">비중</th>
              <th className="w-14 px-2 py-2 text-center font-semibold">공통</th>
              <th className="px-2 py-2 font-semibold">{tickerB}</th>
              <th className="w-16 px-2 py-2 text-right font-semibold">비중</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const aCommon = row.a ? commonSet.has(row.a.ticker) : false;
              const bCommon = row.b ? commonSet.has(row.b.ticker) : false;
              const isCommonRow = aCommon || bCommon;
              return (
                <tr
                  key={row.rank}
                  className="border-b border-slate-100 last:border-0 dark:border-[#222a2c]"
                >
                  <td className="px-2 py-2 text-slate-400">{row.rank}</td>
                  <td className="max-w-[220px] px-2 py-2">
                    <HoldingCell row={row.a} common={aCommon} />
                  </td>
                  <td className="num px-2 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {row.a ? `${row.a.weightPct.toFixed(1)}%` : ""}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {isCommonRow ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">·</span>
                    )}
                  </td>
                  <td className="max-w-[220px] px-2 py-2">
                    <HoldingCell row={row.b} common={bCommon} />
                  </td>
                  <td className="num px-2 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">
                    {row.b ? `${row.b.weightPct.toFixed(1)}%` : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {overlap.comparisonRows.length > 10 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-[#2a3336] dark:text-slate-300 dark:hover:bg-white/5"
        >
          {showAll ? (
            <>
              접기 <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              전체보기 ({overlap.comparisonRows.length}개) <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </section>
  );
}
