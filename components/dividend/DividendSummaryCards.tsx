"use client";

import { formatWon, formatPercent } from "@/lib/format";

interface Props {
  evaluationKRW: number;
  annualDividendKRW: number;
  monthlyAvgKRW: number;
  convertedAnnualDividendKRW: number;
  achievementPct?: number;
  goalProgressLabel: string;
  goalProgressCalculable: boolean;
  withdrawalMode: boolean;
  afterTax: boolean;
  includeTaxAdvantaged: boolean;
  dividendDataAvailable: boolean;
  onToggleTax: (afterTax: boolean) => void;
  onToggleGroup: (includeTaxAdvantaged: boolean) => void;
  onToggleWithdrawalMode: (enabled: boolean) => void;
}

const card =
  "rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-[#2a3336] dark:bg-[#191f20]";

function Kpi({
  label,
  value,
  accent,
  sub,
}: {
  label: string;
  value: string;
  accent?: string;
  sub?: string;
}) {
  return (
    <div className={`min-w-0 ${card}`}>
      <div className="break-keep text-[12.5px] text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`num mt-2 whitespace-nowrap text-[16px] font-extrabold leading-tight sm:text-[20px] ${accent ?? "text-slate-900 dark:text-white"}`}>
        {value}
      </div>
      {sub ? (
        <div className="mt-1 break-keep text-[11px] text-slate-400 dark:text-slate-500">{sub}</div>
      ) : null}
    </div>
  );
}

// 배당 요약 KPI 카드 + 세전/세후 토글
export default function DividendSummaryCards({
  evaluationKRW,
  annualDividendKRW,
  monthlyAvgKRW,
  convertedAnnualDividendKRW,
  achievementPct,
  goalProgressLabel,
  goalProgressCalculable,
  withdrawalMode,
  afterTax,
  includeTaxAdvantaged,
  dividendDataAvailable,
  onToggleTax,
  onToggleGroup,
  onToggleWithdrawalMode,
}: Props) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-slate-700 dark:text-slate-300">배당 요약</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-transparent dark:bg-[#1b2021]">
            <button
              onClick={() => onToggleTax(false)}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                !afterTax ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              세전
            </button>
            <button
              onClick={() => onToggleTax(true)}
              className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                afterTax ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              세후
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-transparent dark:bg-[#1b2021]">
            <button
              onClick={() => onToggleWithdrawalMode(!withdrawalMode)}
              className={`break-keep rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                withdrawalMode ? "bg-violet-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
              aria-pressed={withdrawalMode}
            >
              일괄 3.5% 인출률 적용
            </button>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 dark:border-transparent dark:bg-[#1b2021]">
            <button
              onClick={() => onToggleGroup(false)}
              className={`break-keep rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                !includeTaxAdvantaged ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              위탁만
            </button>
            <button
              onClick={() => onToggleGroup(true)}
              className={`break-keep rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
                includeTaxAdvantaged ? "bg-blue-600 text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              절세합산
            </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        <Kpi label="평가금액" value={formatWon(evaluationKRW)} />
        <Kpi
          label={withdrawalMode ? `연간 예상 금액(3.5% 인출률, ${afterTax ? "세후" : "세전"})` : `연간 예상 배당(추정, ${afterTax ? "세후" : "세전"})`}
          value={withdrawalMode || dividendDataAvailable ? formatWon(annualDividendKRW) : "데이터 없음"}
          accent={withdrawalMode || dividendDataAvailable ? "text-emerald-400" : "text-amber-400"}
          sub={withdrawalMode ? "실제 배당 이력은 반영하지 않습니다" : undefined}
        />
        <Kpi
          label={withdrawalMode ? "월평균 예상 금액(3.5% 가정)" : "월평균 예상 배당(추정)"}
          value={withdrawalMode || dividendDataAvailable ? formatWon(monthlyAvgKRW) : "데이터 없음"}
          accent={withdrawalMode || dividendDataAvailable ? "text-emerald-400" : "text-amber-400"}
        />
        <Kpi
          label="환산 예상 배당"
          value={formatWon(convertedAnnualDividendKRW)}
          accent="text-violet-400"
          sub={`평가금액 × 3.5%${afterTax ? " · 세후" : ""}`}
        />
        <Kpi
          label="목표 달성률"
          value={goalProgressCalculable && achievementPct !== undefined ? formatPercent(achievementPct, 1) : "계산 불가"}
          accent={goalProgressCalculable ? "text-blue-400" : "text-amber-400"}
          sub={goalProgressLabel}
        />
      </div>
    </section>
  );
}
