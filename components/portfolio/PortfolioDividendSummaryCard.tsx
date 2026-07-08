"use client";

import Link from "next/link";
import { formatPercent } from "@/lib/format";
import { useDividendSummary } from "@/lib/use-dividend-summary";
import { useDividendGoal } from "@/lib/dividend-goal-store";
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
  // 배당 목표(티커·주수)는 배당현황 "배당 목표 설정"과 동일한 공유 소스에서 읽는다.
  const goal = useDividendGoal();
  // 배당현황 기본 상태와 동일한 소스. 세전 값을 기준으로 받고 세후는 공유 상수/함수로 환산한다.
  const summary = useDividendSummary({ afterTax: false, targetTicker: goal.ticker, targetQty: goal.qty });
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

  const labelCls = isLight ? "text-slate-400" : "text-slate-500";
  const valueCls = isLight ? "text-slate-800" : "text-slate-300";
  const strongCls = isLight ? "text-slate-900" : "text-white";
  const borderCls = isLight ? "border-slate-200" : "border-[#2a3336]";

  // 총 금융자산 카드와 동일한 타이포 스케일을 공유한다(컴팩트 간격).
  const headCls = `text-[12.5px] font-bold ${isLight ? "text-slate-700" : "text-slate-200"} transition-colors group-hover:text-blue-500 dark:group-hover:text-blue-400`;
  const evalLabelCls = `text-[11px] ${labelCls}`;
  const evalNumberCls = `num mt-0.5 whitespace-nowrap text-[19px] font-extrabold leading-none ${strongCls}`;
  const listCls = `mt-2 space-y-0.5 text-[12.5px] leading-[1.4]`;

  return (
    <Link
      href="/dividends"
      aria-label="배당현황으로 이동"
      className={`group grid cursor-pointer grid-cols-1 gap-x-6 gap-y-4 border-t pt-4 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 sm:grid-cols-2 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0 dark:hover:bg-white/[0.03] ${borderCls} ${className ?? ""}`}
    >
      {/* 배당(위탁) */}
      <div className="min-w-0">
        <div className={headCls}>배당(위탁)</div>
        <div className={`mt-1.5 ${evalLabelCls}`}>평가금액</div>
        <div className={evalNumberCls}>{wonKR(evaluationKRW)}</div>
        <div className={listCls}>
          <div>
            <span className={labelCls}>목표달성률 </span>
            <span className={`num font-semibold ${strongCls}`}>
              {goalProgress.calculable && goalProgress.achievementPct !== undefined
                ? formatPercent(goalProgress.achievementPct, 1)
                : "계산 불가"}
            </span>
            <span className={`ml-1 ${labelCls}`}>
              (목표 {goal.ticker} {goal.qty.toLocaleString("ko-KR")}주)
            </span>
          </div>
          <div className={`num ${valueCls}`}>
            SCHD 실보유 <span className={`font-semibold ${strongCls}`}>{sharesKR(actualShares)}주</span>
            {goalProgress.calculable && equivalentShares !== undefined ? ` (환산 ${sharesKR(equivalentShares)}주)` : ""}
          </div>
          <div className={valueCls}>
            연간 예상 배당{" "}
            {dividendDataAvailable ? (
              <>
                세전 <span className={`num font-semibold ${strongCls}`}>{wonKR(preTaxAnnual)}</span>{" "}
                <span className={labelCls}>(세후 월</span>
                <span className={`num font-semibold ${strongCls}`}>{wonKR(afterTaxMonthly)}</span>
                <span className={labelCls}>)</span>
              </>
            ) : (
              <span className="text-amber-500 dark:text-amber-400">데이터 없음</span>
            )}
          </div>
          <div className={valueCls}>
            환산시 예상 배당 세전 <span className={`num font-semibold ${strongCls}`}>{wonKR(convPreTaxAnnual)}</span>{" "}
            <span className={labelCls}>(세후 월</span>
            <span className={`num font-semibold ${strongCls}`}> {wonKR(convAfterTaxMonthly)}</span>
            <span className={labelCls}>)</span>
          </div>
        </div>
      </div>

      {/* 배당(절세) */}
      <div className={`min-w-0 border-t pt-4 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0 ${borderCls}`}>
        <div className={headCls}>배당(절세)</div>
        <div className={`mt-1.5 ${evalLabelCls}`}>평가금액</div>
        <div className={evalNumberCls}>{wonKR(taxEvalKRW)}</div>
        <div className={listCls}>
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
            <span className={`num font-semibold ${strongCls}`}>{hasPrincipal ? wonKR(principal) : "미설정"}</span>
          </div>
          <div className={valueCls}>
            {monthlyWithdrawalKRW === null ? (
              <span className={labelCls}>원금의 3% 인출 정보 없음 (자산시뮬 저장 필요)</span>
            ) : (
              <>
                원금의 3% 인출시 월<span className={`num font-semibold ${strongCls}`}>{manKR(monthlyWithdrawalKRW)}</span>만 인출가능
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
