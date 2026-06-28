"use client";

import { ArrowDown } from "lucide-react";
import type { ContributionBreakdown } from "@/lib/stock-compare/types";
import { formatSignedPct } from "@/lib/stock-compare/constants";

// =============================================================
// 구성종목 기여도 카드: 최근 TR → 공통 종목 기여 → 비공통 종목 기여.
// 선형 인덱스 분해(가산적)에 따른 이해용 카드. AI 분석 없음.
// =============================================================

interface Props {
  tickerA: string;
  tickerB: string;
  a: ContributionBreakdown;
  b: ContributionBreakdown;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

function Row({ label, weightPct, value, accent }: { label: string; weightPct?: number; value: number | null; accent: string }) {
  const valueColor = value == null ? undefined : value >= 0 ? "#16a34a" : "#dc2626";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 dark:border-[#222a2c] dark:bg-[#11171a]">
      <span className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />
        {label}
        {weightPct != null && (
          <span className="text-[11px] text-slate-400">비중 {weightPct.toFixed(1)}%</span>
        )}
      </span>
      <span className="num text-[13.5px] font-bold" style={{ color: valueColor }}>
        {value == null ? "—" : `${formatSignedPct(value)}p`}
      </span>
    </div>
  );
}

function Block({ ticker, data }: { ticker: string; data: ContributionBreakdown }) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[13.5px] font-bold text-slate-900 dark:text-white">{ticker}</span>
        <span className="num text-[15px] font-extrabold text-slate-900 dark:text-white">
          최근 TR {formatSignedPct(data.trPct)}
        </span>
      </div>
      {data.available ? (
        <div className="space-y-2">
          <div className="flex justify-center text-slate-300 dark:text-slate-600">
            <ArrowDown className="h-4 w-4" />
          </div>
          <Row label="공통 종목 기여" weightPct={data.commonWeightPct} value={data.commonContribPct} accent="#3b82f6" />
          <Row label="비공통 종목 기여" weightPct={data.uniqueWeightPct} value={data.uniqueContribPct} accent="#f59e0b" />
        </div>
      ) : (
        <p className="text-[12px] text-slate-400">구성종목 데이터가 없어 기여도를 분해할 수 없습니다.</p>
      )}
    </div>
  );
}

export default function ContributionCard({ tickerA, tickerB, a, b }: Props) {
  if (!a.available && !b.available) return null;
  return (
    <section className={panel}>
      <h2 className="mb-1 text-[15px] font-bold text-slate-900 dark:text-white">구성종목 기여도</h2>
      <p className="mb-4 text-[12px] text-slate-400">
        공통/비공통 기여(%p)의 합은 최근 TR 과 같습니다(선형 분해, 이해용 근사).
      </p>
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-8">
        <Block ticker={tickerA} data={a} />
        <div className="hidden w-px bg-slate-200 dark:bg-[#2a3336] sm:block" />
        <Block ticker={tickerB} data={b} />
      </div>
    </section>
  );
}
