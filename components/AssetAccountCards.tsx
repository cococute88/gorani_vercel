"use client";

import { formatWon, formatWonSigned, formatPercent } from "@/lib/format";
import { usePortfolioView } from "@/lib/use-portfolio-view";
import {
  classifyAccountStatusGroup,
  ACCOUNT_STATUS_GROUP_ORDER,
  ACCOUNT_STATUS_GROUP_LABEL,
  type AccountStatusGroup,
} from "@/lib/account-status-group";

import type { PortfolioAccountRow } from "@/lib/portfolio-from-snapshots";

type Props = { theme?: "dark" | "light"; compact?: boolean };

// 계좌 카드 grid를 위탁 / 절세(/ 미확인)로 나눠 보여준다.
// PORTFOLIO-PERF-UI-1: 기존 단일 "계좌 현황"을 위탁/절세 두 그룹으로 분리.
// UI-3: compact=true 면 1300px+ 우측 컬럼(트리맵 옆)에 맞춰 카드 폭을 좁혀 2열·작은 패딩으로 렌더링한다.
export default function AssetAccountCards({ theme = "light", compact = false }: Props) {
  const { accountCards, accountAllocationSource } = usePortfolioView();
  const cards: PortfolioAccountRow[] = accountCards;

  const isLight = theme === "light";
  const cardCls = isLight
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-[#171c1d] border border-[#2a3336]";
  const nameCls = isLight ? "text-slate-800" : "text-slate-100";
  const labelCls = isLight ? "text-slate-400" : "text-slate-500";
  const valueCls = isLight ? "text-slate-900" : "text-slate-100";
  const sectionTitleCls = isLight ? "text-slate-700" : "text-slate-200";
  const sectionSubCls = isLight ? "text-slate-400" : "text-slate-500";
  const dividerCls = isLight ? "border-slate-200" : "border-[#2a3336]";

  // 카드를 위탁 / 절세 / 미확인 그룹으로 분류.
  const groups = new Map<AccountStatusGroup, PortfolioAccountRow[]>();
  for (const card of cards) {
    const group = classifyAccountStatusGroup({
      name: card.name,
      type: card.type,
      tax: card.tax,
      statusGroup: card.statusGroup,
    });
    const list = groups.get(group) ?? [];
    list.push(card);
    groups.set(group, list);
  }

  const renderCard = (a: PortfolioAccountRow) => {
    const profitStyle = { color: (a.profit ?? 0) >= 0 ? "#e5484d" : "#3b82f6" };
    const taxCls =
      a.tax === "비과세"
        ? "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400"
        : "bg-slate-500/15 text-slate-500 dark:text-slate-400";
    return (
      <div key={a.name} className={`rounded-xl ${compact ? "p-3 min-[1300px]:p-2.5" : "p-3"} ${cardCls}`}>
        <div className="mb-1.5 flex items-center justify-between gap-1">
          <span className={`truncate text-[12.5px] font-bold ${nameCls}`}>{a.name}</span>
          <span className={`shrink-0 rounded px-1 py-0.5 text-[9.5px] font-medium ${taxCls}`}>
            {a.statusGroup}
          </span>
        </div>
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <span className={`text-[10.5px] ${labelCls}`}>평가</span>
            <span className={`num text-[12.5px] font-bold ${valueCls}`}>{formatWon(a.value)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[10.5px] ${labelCls}`}>수익</span>
            <span className="num text-[11.5px] font-semibold" style={profitStyle}>
              {a.profit === null || a.profit === 0 ? "—" : formatWonSigned(a.profit)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-[10.5px] ${labelCls}`}>수익률</span>
            <span className="num text-[11.5px] font-semibold" style={profitStyle}>
              {a.rate === null || a.rate === 0 ? "—" : formatPercent(a.rate)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderGroup = (group: AccountStatusGroup) => {
    const list = groups.get(group);
    if (!list || list.length === 0) return null;
    const totalValue = list.reduce((sum, a) => sum + a.value, 0);
    const totalProfit = list.reduce((sum, a) => sum + (a.profit ?? 0), 0);
    const profitStyle = { color: totalProfit >= 0 ? "#e5484d" : "#3b82f6" };

    return (
      <section key={group} className="min-w-0">
        <div className={`mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b pb-2 ${dividerCls}`}>
          <h3 className={`text-[14px] font-bold ${sectionTitleCls}`}>
            {ACCOUNT_STATUS_GROUP_LABEL[group]}
            <span className={`ml-2 text-[11.5px] font-medium ${sectionSubCls}`}>
              {list.length}개 계좌
            </span>
          </h3>
          <div className="flex items-baseline gap-2">
            <span className={`num text-[14px] font-extrabold ${valueCls}`}>{formatWon(totalValue)}</span>
            {totalProfit !== 0 && (
              <span className="num text-[11.5px] font-semibold" style={profitStyle}>
                {formatWonSigned(totalProfit)}
              </span>
            )}
          </div>
        </div>
        <div
          className={
            compact
              ? "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 min-[1300px]:grid-cols-2 min-[1300px]:gap-2"
              : "grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4"
          }
        >
          {list.map(renderCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {cards.length > 0 ? (
        <>
          {accountAllocationSource === "holdings" ? (
            <div className={`rounded-xl border px-3 py-2 text-[12px] leading-relaxed ${
              isLight
                ? "border-slate-200 bg-slate-50 text-slate-500"
                : "border-[#2a3336] bg-white/[0.03] text-slate-400"
            }`}>
              계좌별 잔액 정보가 없어 보유종목 기준으로 계좌를 분류했습니다.
            </div>
          ) : null}
          {ACCOUNT_STATUS_GROUP_ORDER.map(renderGroup)}
        </>
      ) : (
        <div className={`rounded-2xl border border-dashed px-4 py-8 text-center text-[13px] leading-relaxed ${
          isLight
            ? "border-slate-200 bg-white text-slate-500"
            : "border-[#2a3336] bg-[#171c1d] text-slate-400"
        }`}>
          계좌별 평가금액 정보가 없어 계좌 현황을 표시할 수 없습니다.
          <br />
          포트폴리오 관리에서 스냅샷을 등록하면 표시됩니다.
        </div>
      )}
    </div>
  );
}
