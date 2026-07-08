"use client";

import {
  formatPercent,
  formatWon,
  formatWonSigned,
} from "@/lib/format";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import MoneyText from "@/components/common/MoneyText";
import PortfolioDividendSummaryCard from "@/components/portfolio/PortfolioDividendSummaryCard";

type Props = { theme?: "dark" | "light" };

const UP = "#e5484d";
const DOWN = "#3b82f6";

function formatMaybeWon(value: number | null): string {
  return value === null ? "—" : formatWon(value);
}

function formatMaybeSignedWon(value: number | null): string {
  return value === null ? "—" : formatWonSigned(value);
}

function formatMaybePercent(value: number | null): string {
  return value === null ? "—" : formatPercent(value);
}

function RatioRow({
  name,
  current,
  color,
  isLight,
}: {
  name: string;
  current: number;
  color: string;
  isLight: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-[12px]">
        <span className={`truncate font-semibold ${isLight ? "text-slate-600" : "text-slate-300"}`}>
          {name}
        </span>
        <span className={`num shrink-0 font-bold ${isLight ? "text-slate-900" : "text-white"}`}>
          {current.toFixed(1)}%
        </span>
      </div>
      <div className={`h-2 w-full overflow-hidden rounded-full ${isLight ? "bg-slate-100" : "bg-[#2a3336]"}`}>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(current, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function PortfolioSummary({ theme = "light" }: Props) {
  const { summary: d, warnings } = usePortfolioView();
  // 상단의 장황한 안내 박스를 없애는 대신, 안내(info)성 caveat 가 있을 때만
  // summary 하단에 아주 짧은 보조문구 한 줄로 축약해 둔다.
  const hasInfoNotice = warnings.some(
    (w) => w.severity === "info" && w.code !== "no_snapshot",
  );
  const isLight = theme === "light";
  const panelCls = isLight
    ? "border-slate-200 bg-white shadow-sm"
    : "border-[#2a3336] bg-[#191f20]";
  const labelCls = isLight ? "text-slate-400" : "text-slate-500";
  const titleCls = isLight ? "text-slate-900" : "text-white";
  const subCls = isLight ? "text-slate-500" : "text-slate-500";
  const valueColor = (d.returnAmountKRW ?? 0) >= 0 ? UP : DOWN;
  const stockCash = d.stockCashTargets;

  return (
    <div className="flex flex-col gap-3 xl:flex-row">
      <div className={`flex-1 rounded-2xl border px-4 py-3.5 ${panelCls}`}>
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-3">
          {/* 1) 총 금융자산 */}
          <div className="flex min-w-0 flex-col xl:pr-6">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className={`text-[12.5px] font-bold ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                총 금융자산
              </span>
              <span className={`text-[11px] ${subCls}`}>
                {d.snapshotDate ? `${d.snapshotDate} 기준` : "스냅샷 없음"}
              </span>
            </div>
            <MoneyText shrink className={`num mt-1.5 break-keep font-extrabold leading-none ${titleCls}`}>
              {formatMaybeWon(d.totalAssetKRW)}
            </MoneyText>
            <div className="mt-2 space-y-0.5 text-[12.5px] leading-[1.4]">
              <div className="flex items-center justify-between gap-3">
                <span className={labelCls}>투자평가금액</span>
                <span className={`num font-semibold ${titleCls}`}>{formatMaybeWon(d.investmentValueKRW)}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={labelCls}>누적 손익</span>
                <span className="num font-semibold" style={{ color: valueColor }}>
                  {formatMaybeSignedWon(d.returnAmountKRW)} ({formatMaybePercent(d.returnPct)})
                </span>
              </div>
            </div>
            <div className={`mt-3 space-y-0.5 text-[12.5px] leading-[1.4] xl:mt-auto xl:pt-3`}>
              <div className="flex items-center justify-between gap-3">
                <span className={labelCls}>현금성/기타 자산</span>
                <span className={`num font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                  {formatMaybeWon(d.cashAndOtherKRW)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={labelCls}>투자원금</span>
                <span className={`num font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                  {formatMaybeWon(d.investmentPrincipalKRW)}
                </span>
              </div>
            </div>
          </div>

          {/* 2)·3) 배당(위탁) / 배당(절세) — 카드 전체 클릭 시 배당현황으로 이동 */}
          <PortfolioDividendSummaryCard isLight={isLight} className="xl:col-span-2" />
        </div>
        {hasInfoNotice ? (
          <p className={`mt-3 text-[11px] ${subCls}`}>
            일부 수익률은 원금 정보가 있는 계좌만 계산됩니다.
          </p>
        ) : null}
      </div>

      <div className={`w-full rounded-2xl border px-4 py-3.5 xl:w-[230px] ${panelCls}`}>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <span className={`text-[12px] font-bold ${isLight ? "text-slate-700" : "text-slate-200"}`}>
            투자 / 현금 비중
          </span>
          <span className={`text-[10.5px] ${subCls}`}>스냅샷 기반</span>
        </div>
        {stockCash.length > 0 ? (
          stockCash.slice(0, 2).map((item, index) => (
            <div key={item.name} className={index > 0 ? "mt-3" : undefined}>
              <RatioRow
                name={item.name}
                current={item.current}
                color={index === 0 ? "#3b82f6" : "#f59e0b"}
                isLight={isLight}
              />
            </div>
          ))
        ) : (
          <div className={`rounded-xl border border-dashed px-3 py-4 text-[12px] leading-relaxed ${
            isLight
              ? "border-slate-200 bg-slate-50 text-slate-500"
              : "border-[#2a3336] bg-white/[0.03] text-slate-400"
          }`}>
            보유종목 평가금액과 현금성 자산 정보가 부족해 비중을 표시할 수 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
