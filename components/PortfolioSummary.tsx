"use client";

import { PORTFOLIO_SUMMARY, PORTFOLIO_SUMMARY_DARK } from "@/lib/mockData";
import {
  formatWon,
  formatWonSigned,
  formatPercent,
  formatEok,
} from "@/lib/format";
import { usePortfolioView } from "@/lib/use-portfolio-view";

type Props = { theme?: "dark" | "light" };

const UP = "#e5484d"; // 수익 빨강

function MiniUpLine({ color = UP }: { color?: string }) {
  return (
    <svg
      viewBox="0 0 140 48"
      className="h-full w-full"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="pf-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d="M0,42 L20,38 L38,40 L58,30 L78,32 L98,20 L118,15 L140,5 L140,48 L0,48 Z"
        fill="url(#pf-up)"
      />
      <path
        d="M0,42 L20,38 L38,40 L58,30 L78,32 L98,20 L118,15 L140,5"
        fill="none"
        stroke={color}
        strokeWidth={2}
      />
    </svg>
  );
}

function TagTargetRow({
  name,
  current,
  target,
  color,
}: {
  name: string;
  current: number;
  target: number;
  color: string;
}) {
  const diff = current - target;
  const diffPositive = diff >= 0;
  const diffStyle = { color: diffPositive ? "#22c55e" : "#e5484d" };
  const barStyle = {
    width: `${Math.min(current, 100)}%`,
    backgroundColor: color,
  };
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[12px]">
        <span className="font-semibold text-slate-300">{name}</span>
        <span className="num font-bold text-white">{current.toFixed(1)}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#2a3336]">
        <div className="h-full rounded-full" style={barStyle} />
      </div>
      <div className="mt-1 flex justify-between text-[10.5px]">
        <span className="text-slate-500">목표 {target}%</span>
        <span className="num font-semibold" style={diffStyle}>
          {diffPositive ? "+" : ""}
          {diff.toFixed(1)}p
        </span>
      </div>
    </div>
  );
}

function DarkSummary() {
  const { summary: d, hasLiveData } = usePortfolioView();
  const upStyle = { color: UP };
  const schdGoal = d.schdGoal;
  const schdRate = Math.min((schdGoal.achieved / schdGoal.target) * 100, 100);
  const schdRemaining = Math.max(schdGoal.target - schdGoal.achieved, 0);
  const principalEok = (d.cumPrincipal / 100000000).toFixed(2);
  const label = "text-[11px] text-slate-500";
  const big = "num break-keep font-extrabold text-white";

  return (
    <div className="flex flex-col gap-3 xl:flex-row">
      {/* 왼쪽 큰 요약 패널 */}
      <div className="flex-1 rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
        <div className="grid min-w-0 grid-cols-1 gap-y-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-y-0 xl:divide-x xl:divide-[#2a3336]">
          {/* 1) 총자산 */}
          <div className="flex min-w-0 flex-col xl:pr-5">
            <div className="mb-1 flex items-center gap-2 text-[11px]">
              <span className="font-bold text-slate-200">금융 총자산</span>
              <span className="text-slate-600">투자 총자산</span>
            </div>
            <span className={`${big} text-[22px]`}>
              {formatWon(d.totalValue)}
            </span>
            <span
              className="num mt-1 text-[12.5px] font-semibold"
              style={upStyle}
            >
              {formatWonSigned(d.totalProfit)} (
              {formatPercent(d.totalProfitRate)})
            </span>
            <span className="mt-1 text-[11px] text-slate-500">
              오늘{" "}
              <span className="num font-semibold" style={upStyle}>
                {formatWonSigned(d.todayProfit)} (
                {formatPercent(d.todayProfitRate)})
              </span>
            </span>
          </div>

          {/* 2) 연간 배당소득 */}
          <div className="flex flex-col xl:px-5">
            <span className={label}>{hasLiveData ? "최근 스냅샷 투자 요약" : "연간 배당소득(예상)"}</span>
            <span className={`${big} mt-1 text-[19px]`}>
              {formatWon(d.annualIncome)}
            </span>
            <div className="mt-1 flex gap-3 text-[11px] text-slate-500">
              <span>
                배당률{" "}
                <span className="num text-slate-300">{d.dividendYield}%</span>
              </span>
              <span>
                투자배당{" "}
                <span className="num text-slate-300">
                  {d.investDividendYield}%
                </span>
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[10.5px] text-slate-500">
              {d.annualDividendWithdrawalEstimates.map((item) => (
                <div key={item.name} className="flex justify-between gap-3">
                  <span>{item.name}</span>
                  <span className="num text-slate-300">
                    {formatWon(item.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3) SCHD 목표 달성률 */}
          <div className="flex flex-col xl:px-5">
            <span className={label}>SCHD 목표 달성률</span>
            <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px] text-slate-500">
              <span>
                목표 금액
                <span className="num mt-0.5 block text-[14px] font-bold text-white">
                  {formatWon(schdGoal.target)}
                </span>
              </span>
              <span>
                달성 금액
                <span className="num mt-0.5 block text-[14px] font-bold text-emerald-400">
                  {formatWon(schdGoal.achieved)}
                </span>
              </span>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-[10.5px] text-slate-500">
                <span>달성률</span>
                <span className="num font-semibold text-orange-400">
                  {schdRate.toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a3336]">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${schdRate}%` }}
                />
              </div>
              <div className="mt-1 text-[10.5px] text-slate-500">
                잔여 금액{" "}
                <span className="num text-slate-300">
                  {formatWon(schdRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* 4) 투자 성과 */}
          <div className="relative flex flex-col overflow-hidden xl:pl-5">
            <span className={label}>투자 성과</span>
            <div className="relative z-10 mt-1 space-y-0.5">
              <div>
                <span className="text-[10.5px] text-slate-500">누적 원금 </span>
                <span className="num text-[16px] font-extrabold text-white">
                  {principalEok}억
                </span>
              </div>
              <div>
                <span className="text-[10.5px] text-slate-500">누적 성과 </span>
                <span className="num text-[14px] font-bold" style={upStyle}>
                  {formatEok(d.cumPerformance)}
                </span>
              </div>
              <div className="num text-[12px] font-semibold text-emerald-400">
                누적수익률 {formatPercent(d.cumReturnRate)}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-2 right-0 h-12 w-28 opacity-70">
              <MiniUpLine />
            </div>
          </div>
        </div>
      </div>

      {/* 오른쪽 주식 현금 비중 카드 */}
      <div className="w-full rounded-2xl border border-[#2a3336] bg-[#191f20] p-4 xl:w-[230px]">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-[12px] font-bold text-slate-200">
            주식 현금 비중
          </span>
          <span className="text-[10.5px] text-slate-500">주식 / 현금</span>
        </div>
        {(d.stockCashTargets.length > 0 ? d.stockCashTargets : PORTFOLIO_SUMMARY_DARK.stockCashTargets).slice(0, 2).map((item, index) => (
          <div key={item.name} className={index > 0 ? "mt-3" : undefined}>
            <TagTargetRow
              name={item.name}
              current={item.current}
              target={item.target}
              color={index === 0 ? "#3b82f6" : "#f59e0b"}
            />
          </div>
        ))}
        <div className="mt-3 text-[10px] leading-snug text-slate-600">
          현재비율 / 목표 차이 (5%p 이상 강조)
        </div>
      </div>
    </div>
  );
}

function LightSummary() {
  const d = PORTFOLIO_SUMMARY;
  const upStyle = { color: UP };
  const principalEok = (d.cumPrincipal / 100000000).toFixed(2);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="grid grid-cols-2 gap-y-5 lg:grid-cols-4 lg:divide-x lg:divide-slate-200">
        <div className="flex flex-col lg:pr-6">
          <span className="text-[12px] text-slate-400">전체 계좌 요약</span>
          <span className="num mt-1 text-[24px] font-extrabold text-slate-900">
            {formatWon(d.totalValue)}
          </span>
          <span className="num mt-1 text-[13px] font-semibold" style={upStyle}>
            {formatWonSigned(d.totalProfit)} ({formatPercent(d.totalProfitRate)}
            )
          </span>
        </div>
        <div className="flex flex-col lg:px-6">
          <span className="text-[12px] text-slate-400">연간 배당</span>
          <span className="num mt-1 text-[19px] font-extrabold text-slate-900">
            {formatWon(d.annualDividend)}
          </span>
          <span className="mt-1 text-[12px] text-slate-500">
            월 평균{" "}
            <span className="num">{formatWon(d.monthlyAvgDividend)}</span>
          </span>
        </div>
        <div className="flex flex-col lg:px-6">
          <span className="text-[12px] text-slate-400">과세 / 비과세</span>
          <span className="num mt-1 text-[15px] font-bold text-slate-900">
            {formatWon(d.taxable)}
          </span>
          <span className="num text-[13px] text-slate-500">
            {formatWon(d.nonTaxable)}
          </span>
        </div>
        <div className="flex flex-col lg:pl-6">
          <span className="text-[12px] text-slate-400">누적 수익률</span>
          <span className="num mt-1 text-[19px] font-extrabold" style={upStyle}>
            {formatPercent(d.cumReturnRate)}
          </span>
          <span className="num text-[12px] text-slate-500">
            원금 {principalEok}억
          </span>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioSummary({ theme = "light" }: Props) {
  if (theme === "light") return <LightSummary />;
  return <DarkSummary />;
}
