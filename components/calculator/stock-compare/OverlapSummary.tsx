"use client";

import { Layers } from "lucide-react";
import type { OverlapResult } from "@/lib/stock-compare/types";

// =============================================================
// 구성종목 중복 분석 카드: 공통 종목 수 / A·B 대비 중복 비율 /
// 실제 비중 기준 중복도. 비중을 반드시 반영한다.
// =============================================================

interface Props {
  tickerA: string;
  tickerB: string;
  overlap: OverlapResult;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

function StatBox({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-[#2a3336] dark:bg-[#11171a]">
      <div className="text-[12px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div className="num mt-1 text-[20px] font-extrabold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-400">{sub}</div>}
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
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-[#222a2c]">
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

  return (
    <section className={panel}>
      <h2 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-slate-900 dark:text-white">
        <Layers className="h-4 w-4 text-blue-500" /> 구성종목 중복 분석
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="공통 종목 수" value={`${overlap.commonCount}개`} sub={`상위 보유 기준`} />
        <StatBox
          label="실제 비중 중복도"
          value={`${overlap.mutualWeightPct.toFixed(1)}%`}
          sub="Σ min(비중A, 비중B)"
        />
        <StatBox label={`${tickerA} 중복(개수)`} value={`${overlap.countOverlapPctA.toFixed(0)}%`} />
        <StatBox label={`${tickerB} 중복(개수)`} value={`${overlap.countOverlapPctB.toFixed(0)}%`} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Bar label={`${tickerA} 내 공통 종목 비중`} pct={overlap.weightOverlapPctA} color="#3b82f6" />
        <Bar label={`${tickerB} 내 공통 종목 비중`} pct={overlap.weightOverlapPctB} color="#ec4899" />
      </div>

      {overlap.commonTickers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {overlap.commonTickers.map((t) => (
            <span
              key={t}
              className="rounded-md bg-blue-50 px-2 py-0.5 text-[11.5px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
