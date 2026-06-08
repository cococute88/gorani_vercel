"use client";

import { formatWon, formatPercent } from "@/lib/format";

interface Props {
  evaluationKRW: number;
  annualDividendKRW: number;
  monthlyAvgKRW: number;
  achievementPct: number;
  afterTax: boolean;
  onToggleTax: (afterTax: boolean) => void;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className={card}>
      <div className="text-[12.5px] text-slate-400">{label}</div>
      <div className={`num mt-2 text-[20px] font-extrabold ${accent ?? "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

// 배당 요약 KPI 카드 + 세전/세후 토글
export default function DividendSummaryCards({
  evaluationKRW,
  annualDividendKRW,
  monthlyAvgKRW,
  achievementPct,
  afterTax,
  onToggleTax,
}: Props) {
  return (
    <section className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-300">배당 요약</h2>
        <div className="flex items-center gap-1 rounded-lg bg-[#1b2021] p-1">
          <button
            onClick={() => onToggleTax(false)}
            className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
              !afterTax ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            세전
          </button>
          <button
            onClick={() => onToggleTax(true)}
            className={`rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${
              afterTax ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            세후
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="평가금액" value={formatWon(evaluationKRW)} />
        <Kpi
          label={`연간 예상 배당${afterTax ? " (세후)" : " (세전)"}`}
          value={formatWon(annualDividendKRW)}
          accent="text-emerald-400"
        />
        <Kpi
          label="월평균 예상 배당"
          value={formatWon(monthlyAvgKRW)}
          accent="text-emerald-400"
        />
        <Kpi
          label="목표 달성률"
          value={formatPercent(achievementPct, 1)}
          accent="text-blue-400"
        />
      </div>
    </section>
  );
}
