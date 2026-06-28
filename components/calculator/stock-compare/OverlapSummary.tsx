"use client";

import { Layers } from "lucide-react";
import type { OverlapResult } from "@/lib/stock-compare/types";

// =============================================================
// 구성종목 중복 분석.
//
// 카드 의미가 겹치지 않도록 두 묶음으로 단순화한다.
//  - 왼쪽: "얼마나 겹치나" → 종목 개수 기준 중복도 / 실제 비중 기준 중복도
//  - 오른쪽: "각 ETF 안에서 공통 종목이 차지하는 비중" → A / B 비중 막대
// 비중을 반드시 반영하며, 개수 기준 수치는 참고용임을 명확히 표기한다.
// =============================================================

interface Props {
  tickerA: string;
  tickerB: string;
  overlap: OverlapResult;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";
const subCard = "rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-[#2a3336] dark:bg-[#11171a]";

function MetricLine({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div>
      <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="num mt-0.5 text-[22px] font-extrabold text-slate-900 dark:text-white">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-slate-400">{hint}</div>
    </div>
  );
}

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{label}</span>
        <span className="num font-bold text-slate-900 dark:text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#222a2c]">
        <div className="h-full rounded-full transition-all" style={{ width: `${clamped}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function OverlapSummary({ tickerA, tickerB, overlap }: Props) {
  if (!overlap.hasHoldings) {
    return (
      <section className={panel}>
        <h2 className="mb-1 flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
          <Layers className="h-4 w-4 text-blue-500" /> 구성종목 중복 분석
        </h2>
        <p className="text-[13px] text-slate-500 dark:text-slate-400">
          {tickerA} 또는 {tickerB} 의 구성종목(Holdings) 데이터가 없어 중복 분석을 제공할 수 없습니다. 개별 주식이거나
          지원되지 않는 ETF 일 수 있습니다. 성과·위험지표 비교는 정상적으로 제공됩니다.
        </p>
      </section>
    );
  }

  // 개수 기준 중복도: A·B 가 다르면 둘 다, 같으면 하나로 표기.
  const countA = overlap.countOverlapPctA;
  const countB = overlap.countOverlapPctB;
  const countValue =
    Math.round(countA) === Math.round(countB)
      ? `${countA.toFixed(0)}% (${overlap.commonCount}개)`
      : `${countA.toFixed(0)} / ${countB.toFixed(0)}% (${overlap.commonCount}개)`;
  const countHint =
    Math.round(countA) === Math.round(countB)
      ? "공통 종목 수 ÷ 상위 보유 종목 수 (참고용)"
      : `${tickerA} / ${tickerB} 각각의 상위 보유 종목 수 대비 (참고용)`;

  return (
    <section className={panel}>
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
        <Layers className="h-4 w-4 text-blue-500" /> 구성종목 중복 분석
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 왼쪽: 얼마나 겹치나 */}
        <div className={subCard}>
          <div className="mb-3 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">두 종목이 얼마나 겹치나</div>
          <div className="space-y-4">
            <MetricLine label="종목 개수 기준 중복도" value={countValue} hint={countHint} />
            <MetricLine
              label="실제 비중 중복도"
              value={`${overlap.mutualWeightPct.toFixed(1)}%`}
              hint="양쪽이 공통으로 보유한 비중 · Σ min(비중A, 비중B)"
            />
          </div>
        </div>

        {/* 오른쪽: 각 ETF 안에서 공통 종목 비중 */}
        <div className={subCard}>
          <div className="mb-3 text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
            각 ETF 안에서 공통 종목이 차지하는 비중
          </div>
          <div className="space-y-4">
            <Bar label={`${tickerA} 내 공통 종목 비중`} pct={overlap.weightOverlapPctA} color="#3b82f6" />
            <Bar label={`${tickerB} 내 공통 종목 비중`} pct={overlap.weightOverlapPctB} color="#ec4899" />
            <p className="text-[11.5px] text-slate-400">
              같은 공통 종목이라도 ETF 별 비중이 다르면 성과 기여가 달라집니다.
            </p>
          </div>
        </div>
      </div>

      {overlap.commonTickers.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 text-[11.5px] font-semibold text-slate-500 dark:text-slate-400">
            공통 종목 ({overlap.commonCount}개)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {overlap.commonTickers.map((t) => (
              <span
                key={t}
                className="rounded-md bg-blue-50 px-2 py-0.5 text-[11.5px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
