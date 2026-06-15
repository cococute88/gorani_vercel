"use client";

import {
  formatCompactKrw,
  formatPercent,
  formatWon,
  formatWonSigned,
} from "@/lib/format";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import MoneyText from "@/components/common/MoneyText";

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

function MiniUpLine({ color = UP }: { color?: string }) {
  return (
    <svg viewBox="0 0 140 48" className="h-full w-full" preserveAspectRatio="none">
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
  const { summary: d, warnings, flags } = usePortfolioView();
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
      <div className={`flex-1 rounded-2xl border p-4 ${panelCls}`}>
        <div className={`grid min-w-0 grid-cols-1 gap-y-4 sm:grid-cols-2 xl:grid-cols-3 xl:gap-y-0 xl:divide-x ${isLight ? "xl:divide-slate-200" : "xl:divide-[#2a3336]"}`}>
          <div className="flex min-w-0 flex-col xl:pr-5">
            <div className="mb-1 flex items-center gap-2 text-[11px]">
              <span className={`font-bold ${isLight ? "text-slate-700" : "text-slate-200"}`}>
                총 금융자산
              </span>
              <span className={subCls}>
                {d.snapshotDate ? `${d.snapshotDate} 기준` : "스냅샷 없음"}
              </span>
            </div>
            <MoneyText shrink className={`break-keep font-extrabold ${titleCls}`}>
              {formatMaybeWon(d.totalAssetKRW)}
            </MoneyText>
            <span className={`mt-1 text-[11px] ${subCls}`}>총 금융자산은 투자 평가금액과 현금성/기타 자산을 포함합니다.</span>
            <span className="num mt-1 text-[12.5px] font-semibold" style={{ color: valueColor }}>
              누적 손익 {formatMaybeSignedWon(d.returnAmountKRW)} ({formatMaybePercent(d.returnPct)})
            </span>
            <span className={`mt-1 text-[11px] ${subCls}`}>
              최신 스냅샷 기준
            </span>
          </div>

          <div className="flex flex-col xl:px-5">
            <span className={`text-[11px] ${labelCls}`}>투자 평가금액</span>
            <span className={`num mt-1 text-[19px] font-extrabold ${titleCls}`}>
              {formatMaybeWon(d.investmentValueKRW)}
            </span>
            <div className={`mt-1 space-y-1 text-[11px] ${subCls}`}>
              <div className="flex justify-between gap-3">
                <span>현금성/기타 자산</span>
                <span className={`num font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                  {formatMaybeWon(d.cashAndOtherKRW)}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span>투자원금</span>
                <span className={`num font-semibold ${isLight ? "text-slate-800" : "text-slate-300"}`}>
                  {formatMaybeWon(d.investmentPrincipalKRW)}
                </span>
              </div>
            </div>
          </div>

          <div className="relative flex min-w-0 flex-col overflow-hidden xl:pl-5">
            <span className={`text-[11px] ${labelCls}`}>데이터 상태</span>
            <div className="relative z-10 mt-1 space-y-0.5">
              <div className="flex min-w-0 items-baseline gap-1">
                <span className={`shrink-0 text-[10.5px] ${subCls}`}>불러온 파일</span>
                <span className={`truncate text-[13px] font-bold ${titleCls}`} title={d.sourceFileName || undefined}>
                  {d.sourceFileName || "—"}
                </span>
              </div>
              <div>
                <span className={`text-[10.5px] ${subCls}`}>투자 평가금액 </span>
                <span className="num text-[14px] font-bold" style={{ color: valueColor }}>
                  {d.investmentValueKRW === null ? "—" : formatCompactKrw(d.investmentValueKRW)}
                </span>
              </div>
              <div className={`text-[12px] font-semibold ${flags.hasSnapshot ? "text-emerald-500" : "text-amber-500"}`}>
                {flags.hasSnapshot ? "최신 스냅샷 실데이터" : "스냅샷 등록 전"}
              </div>
            </div>
            <div className="pointer-events-none absolute bottom-2 right-0 h-12 w-28 opacity-70">
              <MiniUpLine color={valueColor} />
            </div>
          </div>
        </div>
        {hasInfoNotice ? (
          <p className={`mt-3 text-[11px] ${subCls}`}>
            일부 수익률은 원금 정보가 있는 계좌만 계산됩니다.
          </p>
        ) : null}
      </div>

      <div className={`w-full rounded-2xl border p-4 xl:w-[230px] ${panelCls}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
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
