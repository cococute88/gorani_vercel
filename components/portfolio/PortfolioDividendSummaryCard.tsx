"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { formatWon, formatWonSigned, formatPercent } from "@/lib/format";
import { useDividendSummary } from "@/lib/use-dividend-summary";
import { useTaxAccountPrincipalKRW } from "@/lib/tax-account-principal";

// 3% 인출 계산은 절세계좌의 "납입원금" 기준이다(투자원금 아님).
const TAX_ACCOUNT_WITHDRAWAL_RATE = 0.03;

// 투자현황의 "데이터 상태" 카드를 대체하는 배당 요약 카드.
// - 배당 데이터(위탁)는 배당현황 페이지와 동일한 useDividendSummary 훅으로 계산한다.
//   (중복 계산·별도 계산식 없이 두 화면 숫자가 항상 일치한다.)
// - 절세계좌 납입원금/3% 인출은 자산시뮬레이터 Save 값(기존 ISA+연금저축 잔고) 기준이다.
// - 카드 전체를 클릭하면 배당 → 배당현황으로 이동한다.

function Row({
  label,
  value,
  accent,
  strong,
}: {
  label: string;
  value: string;
  accent?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-500">{label}</span>
      <span
        className={`num truncate text-right ${strong ? "text-[13.5px] font-extrabold" : "text-[12.5px] font-semibold"} ${
          accent ?? "text-slate-900 dark:text-white"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

export default function PortfolioDividendSummaryCard() {
  // 배당현황 페이지 기본 상태(세후 · 위탁만 · 목표 SCHD 3300주)와 동일한 기준으로 호출한다.
  const summary = useDividendSummary();
  const taxPrincipalKRW = useTaxAccountPrincipalKRW();

  const {
    evaluationKRW,
    annualDividendKRW,
    monthlyAvgKRW,
    convertedAnnualDividendKRW,
    convertedMonthlyDividendKRW,
    dividendDataAvailable,
    goalProgress,
    dividendGroups,
  } = summary;

  const brokerageEvaluationKRW = evaluationKRW;
  const actualShares = goalProgress.actualShares;
  const equivalentShares = goalProgress.equivalentShares;

  const taxAdvantagedEvaluationKRW = dividendGroups.taxAdvantagedTotalKRW;
  const hasPrincipal = taxPrincipalKRW !== null && taxPrincipalKRW > 0;
  const cumulativeProfitKRW = hasPrincipal ? taxAdvantagedEvaluationKRW - (taxPrincipalKRW ?? 0) : null;
  const monthlyWithdrawalKRW = hasPrincipal ? ((taxPrincipalKRW ?? 0) * TAX_ACCOUNT_WITHDRAWAL_RATE) / 12 : null;

  const dividendValue = (value: number) => (dividendDataAvailable ? formatWon(value) : "데이터 없음");
  const dividendAccent = dividendDataAvailable ? "text-emerald-500 dark:text-emerald-400" : "text-amber-500 dark:text-amber-400";

  return (
    <Link
      href="/dividends"
      aria-label="배당현황으로 이동"
      className="group block cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 dark:border-[#2a3336] dark:bg-[#191f20] dark:hover:border-blue-500/50"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200">배당 요약</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400 transition-colors group-hover:text-blue-500 dark:text-slate-500 dark:group-hover:text-blue-400">
          배당현황
          <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* 배당(위탁) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-[#2a3336] dark:bg-white/[0.02]">
          <div className="mb-2 text-[11.5px] font-bold text-slate-600 dark:text-slate-300">배당(위탁)</div>
          <div className="space-y-1">
            <Row label="평가금액" value={formatWon(brokerageEvaluationKRW)} strong />
            <Row
              label="목표 달성률"
              value={goalProgress.calculable && goalProgress.achievementPct !== undefined ? formatPercent(goalProgress.achievementPct, 1) : "계산 불가"}
              accent={goalProgress.calculable ? "text-blue-500 dark:text-blue-400" : "text-amber-500 dark:text-amber-400"}
            />
            <Row
              label="SCHD 실보유/환산"
              value={
                goalProgress.calculable && equivalentShares !== undefined
                  ? `${actualShares.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} / ${equivalentShares.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}주`
                  : "—"
              }
            />
            <Row label="연간 예상 배당" value={dividendValue(annualDividendKRW)} accent={dividendAccent} />
            <Row label="월 예상 배당" value={dividendValue(monthlyAvgKRW)} accent={dividendAccent} />
            <Row label="환산 예상 배당(연)" value={formatWon(convertedAnnualDividendKRW)} accent="text-violet-500 dark:text-violet-400" />
            <Row label="환산 예상 배당(월)" value={formatWon(convertedMonthlyDividendKRW)} accent="text-violet-500 dark:text-violet-400" />
          </div>
        </div>

        {/* 배당(절세) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 dark:border-[#2a3336] dark:bg-white/[0.02]">
          <div className="mb-2 text-[11.5px] font-bold text-slate-600 dark:text-slate-300">배당(절세)</div>
          <div className="space-y-1">
            <Row label="평가금액" value={formatWon(taxAdvantagedEvaluationKRW)} strong />
            <Row
              label="누적 수익"
              value={cumulativeProfitKRW === null ? "—" : formatWonSigned(cumulativeProfitKRW)}
              accent={
                cumulativeProfitKRW === null
                  ? undefined
                  : cumulativeProfitKRW >= 0
                    ? "text-[#e5484d]"
                    : "text-[#3b82f6]"
              }
            />
            <Row label="납입원금" value={hasPrincipal ? formatWon(taxPrincipalKRW ?? 0) : "미설정"} />
            <Row
              label="월 인출(납입원금 3%)"
              value={monthlyWithdrawalKRW === null ? "미설정" : formatWon(monthlyWithdrawalKRW)}
              accent="text-emerald-500 dark:text-emerald-400"
            />
          </div>
          {!hasPrincipal ? (
            <p className="mt-2 text-[10.5px] leading-relaxed text-slate-400 dark:text-slate-500">
              자산시뮬레이터에서 기존 ISA·연금저축 잔고를 입력하고 저장하면 납입원금이 반영됩니다.
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
