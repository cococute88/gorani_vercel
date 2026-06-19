"use client";

import { useMemo, useState } from "react";
import type { Holding } from "@/lib/portfolio-types";
import {
  ACCOUNT_TABS,
  aggregateHoldingWeights,
  type AccountTabKey,
} from "@/lib/account-holding-weights";
import { formatCompactKrw } from "@/lib/format";

interface Props {
  holdings: Holding[];
}

const card =
  "box-border flex h-full min-h-[300px] w-full min-w-0 flex-col rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 누적 바 세그먼트 안에 라벨을 표시할 최소 비중(%) 임계값.
const INLINE_LABEL_MIN_PCT = 8;

// 계좌별 종목 비중 조회 카드.
// 계좌 필터 탭 → 100% 누적 가로 스택 바 → 하단 범례(2열) 구성.
export default function AccountHoldingWeightCard({ holdings }: Props) {
  const [tab, setTab] = useState<AccountTabKey>("전체");

  // 탭 선택 시 즉시 재계산된다.
  const slices = useMemo(() => aggregateHoldingWeights(holdings, tab), [holdings, tab]);
  const total = useMemo(() => slices.reduce((sum, s) => sum + s.valueKRW, 0), [slices]);

  return (
    <div className={card}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-300">계좌별 종목 비중 조회</h2>
        {total > 0 && (
          <span className="num text-[12px] text-slate-500">총 {formatCompactKrw(total)}</span>
        )}
      </div>

      {/* 계좌 필터 탭 (가로 배치, 선택 탭 강조) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ACCOUNT_TABS.map((key) => {
          const active = key === tab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={active}
              className={`rounded-lg px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                active
                  ? "bg-blue-600 text-white"
                  : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      {slices.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#2a3336] bg-white/[0.03] px-4 py-10 text-center text-[13px] leading-relaxed text-slate-400">
          {holdings.length === 0
            ? "엑셀을 업로드하면 계좌별 종목 비중이 표시됩니다."
            : "100만원 이상인 종목이 없어 비중을 표시할 수 없습니다."}
        </div>
      ) : (
        <>
          {/* 100% 누적 가로 스택 바 */}
          <div className="flex h-9 w-full overflow-hidden rounded-lg">
            {slices.map((slice) => (
              <div
                key={slice.key}
                title={`${slice.name} ${slice.weightPct.toFixed(1)}%`}
                style={{ width: `${slice.weightPct}%`, backgroundColor: slice.color }}
                className="flex h-full items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[11px] font-semibold text-white/95"
              >
                {slice.weightPct >= INLINE_LABEL_MIN_PCT
                  ? `${slice.name} ${slice.weightPct.toFixed(0)}%`
                  : ""}
              </div>
            ))}
          </div>

          {/* 하단 범례 (2열 반응형, 색상은 막대와 동일) */}
          <ul className="mt-4 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {slices.map((slice) => (
              <li key={slice.key} className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-slate-200">
                  {slice.name}
                </span>
                <span className="num shrink-0 text-[12px] font-semibold text-slate-300">
                  {slice.weightPct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
