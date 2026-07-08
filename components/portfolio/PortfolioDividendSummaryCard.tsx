"use client";

import Link from "next/link";
import { formatPercent } from "@/lib/format";
import { useDividendSummary } from "@/lib/use-dividend-summary";
import { useTaxAccountPrincipalKRW } from "@/lib/tax-account-principal";
import { computeConvertedAnnualDividendKRW, DIVIDEND_AFTER_TAX_FACTOR } from "@/lib/dividend-estimates";

// 3% 인출은 절세계좌 "납입원금" 기준(투자원금 아님).
const TAX_ACCOUNT_WITHDRAWAL_RATE = 0.03;
const UP = "#e5484d";
const DOWN = "#3b82f6";

// 참고 이미지의 배당(위탁)/배당(절세) 컬럼. 총 금융자산 카드 우측에 두 컬럼으로 붙는다.
// - 배당 수치는 배당현황과 동일한 useDividendSummary(공유 훅)에서만 계산한다(중복 계산 없음).
//   세전 연간 = 배당현황 "세전" 토글값, 세후 월 = 배당현황 "세후" 월평균과 각각 동일하다.
// - 절세 납입원금/3% 인출은 자산시뮬레이터 Save 값(기존 ISA+연금저축 잔고) 기준이다.
// - 두 컬럼 전체가 배당 → 배당현황으로 이동하는 링크이며 hover/cursor 를 유지한다.

function wonKR(value: number): string {
  return Math.round(value).toLocaleString("ko-KR") + "원";
}

function sharesKR(value: number): string {
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

function manKR(value: number): string {
  return (value / 10_000).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

type Props = { isLight: boolean; className?: string };

export default function PortfolioDividendSummaryCard({ isLight, className }: Props) {
  // 배당현황 기본 상태와 동일한 소스. 세전 값을 기준으로 받고 세후는 공유 상수/함수로 환산한다.
  const summary = useDividendSummary({ afterTax: false });
  const taxPrincipalKRW = useTaxAccountPrincipalKRW();

  const { evaluationKRW, annualDividendKRW, convertedAnnualDividendKRW, dividendDataAvailable, goalProgress, dividendGroups } = summary;

  // 배당(위탁): 세전 연간 + 세후 월 (배당현황 세전/세후 토글값과 각각 일치).
  const preTaxAnnual = annualDividendKRW;
  const afterTaxMonthly = Math.round((preTaxAnnual * DIVIDEND_AFTER_TAX_FACTOR) / 12);
  const convPreTaxAnnual = convertedAnnualDividendKRW; // afterTax:false → 평가금액 × 3.5%
  const convAfterTaxMonthly = Math.round(computeConvertedAnnualDividendKRW(evaluationKRW, { afterTax: true }) / 12);
  const actualShares = goalProgress.actualShares;
  const equivalentShares = goalProgress.equivalentShares;

  // 배당(절세): 납입원금 기준 누적 수익 / 3% 월 인출.
  const taxEvalKRW = dividendGroups.taxAdvantagedTotalKRW;
  const hasPrincipal = taxPrincipalKRW !== null && taxPrincipalKRW > 0;
  const principal = taxPrincipalKRW ?? 0;
  const profitKRW = hasPrincipal ? taxEvalKRW - principal : null;
  const profitPct = hasPrincipal && principal > 0 ? ((taxEvalKRW - principal) / principal) * 100 : null;
  const monthlyWithdrawalKRW = hasPrincipal ? (principal * TAX_ACCOUNT_WITHDRAWAL_RATE) / 12 : null;

  const labelCls = isLight ? "text-slate-500" : "text-slate-400";
  const valueCls = isLight ? "text-slate-900" : "text-slate-100";
  const titleCls = isLight ? "text-slate-800" : "text-white";
  const borderCls = isLight ? "border-slate-200" : "border-[#2a3336]";
  const line = "text-[13px] leading-[1.75]";

  return (
    <Link
      href="/dividends"
      aria-label="배당현황으로 이동"
      className={`group grid cursor-pointer grid-cols-1 gap-x-6 gap-y-4 border-t pt-5 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 dark:hover:bg-white/[0.03] ${borderCls} ${className ?? ""}`}
    >
      {/* 배당(위탁) */}
      <div className={`min-w-0 ${line}`}>
        <div className={`mb-0.5 font-extrabold ${titleCls} transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400`}>
          배당(위탁)
        </div>
        <div>
          <span className={labelCls}>평가금액 </span>
          <span className={`num font-semibold ${valueCls}`}>{wonKR(evaluationKRW)}</span>
        </div>
        <div>
          <span className={labelCls}>목표달성률 </span>
          <span className={`num font-semibold ${valueCls}`}>
            {goalProgress.calculable && goalProgress.achievementPct !== undefined
              ? formatPercent(goalProgress.achievementPct, 1)
              : "계산 불가"}
          </span>
        </div>
        <div className={`num ${valueCls}`}>
          SCHD 실보유 {sharesKR(actualShares)}주
          {goalProgress.calculable && equivalentShares !== undefined ? ` (환산 ${sharesKR(equivalentShares)}주)` : ""}
        </div>
        <div className={valueCls}>
          연간 예상 배당{" "}
          {dividendDataAvailable ? (
            <>
              세전 <span className="num font-semibold">{wonKR(preTaxAnnual)}</span> (세후 월
              <span className="num font-semibold">{wonKR(afterTaxMonthly)}</span>)
            </>
          ) : (
            <span className="text-amber-500 dark:text-amber-400">데이터 없음</span>
          )}
        </div>
        <div className={valueCls}>
          환산시 예상 배당 세전 <span className="num font-semibold">{wonKR(convPreTaxAnnual)}</span> (세후 월{" "}
          <span className="num font-semibold">{wonKR(convAfterTaxMonthly)}</span>)
        </div>
      </div>

      {/* 배당(절세) */}
      <div className={`min-w-0 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 ${borderCls} ${line}`}>
        <div className={`mb-0.5 font-extrabold ${titleCls} transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400`}>
          배당(절세)
        </div>
        <div>
          <span className={labelCls}>평가금액 </span>
          <span className={`num font-semibold ${valueCls}`}>{wonKR(taxEvalKRW)}</span>
        </div>
        <div>
          <span className={labelCls}>누적 수익 </span>
          {profitKRW === null ? (
            <span className={valueCls}>—</span>
          ) : (
            <span className="num font-semibold" style={{ color: profitKRW >= 0 ? UP : DOWN }}>
              {(profitKRW >= 0 ? "+" : "-") + wonKR(Math.abs(profitKRW))}
              {profitPct !== null ? ` (${formatPercent(profitPct, 1)})` : ""}
            </span>
          )}
        </div>
        <div>
          <span className={labelCls}>납입원금 </span>
          <span className={`num font-semibold ${valueCls}`}>{hasPrincipal ? wonKR(principal) : "미설정"}</span>
        </div>
        <div className={valueCls}>
          {monthlyWithdrawalKRW === null ? (
            <span className={labelCls}>원금의 3% 인출 정보 없음 (자산시뮬 저장 필요)</span>
          ) : (
            <>
              원금의 3% 인출시 월<span className="num font-semibold">{manKR(monthlyWithdrawalKRW)}</span>만 인출가능
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
