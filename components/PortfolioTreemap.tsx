"use client";

import { formatCompactKrw } from "@/lib/format";
import type { PortfolioTreemapItem } from "@/lib/portfolio-from-snapshots";
import { holdingDisplayLabel } from "@/lib/holding-display-label";
import { treemapColorCategory, TREEMAP_CATEGORY_CLASSES } from "@/lib/treemap-color";

type Props = {
  items: PortfolioTreemapItem[];
  theme?: "dark" | "light";
};

// 종목 면적을 전체 평가금액 비중(weightPct)에 비례시킨다.
// flex-grow 는 valueKRW 로, 목표 폭(basis)과 최소 높이는 전역 weightPct 로 잡아
// 큰 비중(TQQQ 등)은 확실히 크게, 작은 비중은 작게 보이도록 한다.
function tileSizing(item: PortfolioTreemapItem) {
  const weight = Math.max(0, item.weightPct);
  // 목표 폭: 비중에 비례하되 너무 좁아 읽히지 않는 것은 방지(min 88px).
  const basis = `clamp(88px, ${weight.toFixed(1)}%, 100%)`;
  // 최소 높이: 비중이 클수록 더 높게 (대략 56px~190px).
  const minHeight = Math.round(Math.min(190, Math.max(56, 52 + weight * 4)));
  return { flex: `${Math.max(item.valueKRW, 1)} 1 ${basis}`, minHeight };
}

function Group({
  title,
  items,
  isLight,
}: {
  title: string;
  items: PortfolioTreemapItem[];
  isLight: boolean;
}) {
  return (
    <div className="box-border flex min-w-0 w-full max-w-full flex-col">
      <div className={`mb-1.5 truncate text-[12px] font-semibold ${isLight ? "text-slate-500" : "text-slate-400"}`}>
        {title}
      </div>
      <div className="flex min-w-0 w-full max-w-full flex-wrap gap-1 overflow-hidden">
        {items.map((item) => {
          const category = treemapColorCategory({ name: item.name, ticker: item.ticker });
          const colorCls = isLight
            ? TREEMAP_CATEGORY_CLASSES[category].light
            : TREEMAP_CATEGORY_CLASSES[category].dark;
          const subTextCls = isLight ? "text-slate-700" : "text-white/80";
          const label = holdingDisplayLabel({ name: item.name, ticker: item.ticker });

          return (
            <div
              key={`${item.group}-${item.ticker || item.name}`}
              className={`box-border flex min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-md p-2 ${colorCls}`}
              style={tileSizing(item)}
              title={`${label}${item.ticker ? ` (${item.ticker})` : ""}`}
            >
              <span className="line-clamp-2 break-keep text-[12px] font-bold leading-tight">
                {label}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="num truncate text-[12px] font-extrabold">
                  {item.returnPct === null
                    ? "수익률 —"
                    : `${item.returnPct > 0 ? "+" : ""}${item.returnPct.toFixed(1)}%`}
                </div>
                <div className={`num truncate text-[10px] ${subTextCls}`}>
                  {formatCompactKrw(item.valueKRW)} · {item.weightPct.toFixed(1)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PortfolioTreemap({ items, theme = "dark" }: Props) {
  const isLight = theme === "light";
  const cardCls = isLight
    ? "border-slate-200 bg-white shadow-sm"
    : "border-[#2a3336] bg-[#191f20]";
  const titleCls = isLight ? "text-slate-800" : "text-slate-100";
  const grouped = Array.from(
    items.reduce((map, item) => {
      const key = item.group || "미분류";
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
      return map;
    }, new Map<string, PortfolioTreemapItem[]>()),
  ).sort((a, b) => b[1].reduce((sum, item) => sum + item.valueKRW, 0) - a[1].reduce((sum, item) => sum + item.valueKRW, 0));

  return (
    <div className={`box-border min-h-[300px] w-full max-w-full min-w-0 overflow-x-hidden rounded-2xl border p-4 sm:min-h-[320px] ${cardCls}`}>
      <div className={`mb-3 text-[14px] font-bold ${titleCls}`}>보유종목 트리맵</div>
      {items.length > 0 ? (
        <div className="flex min-w-0 w-full max-w-full flex-col gap-4">
          {grouped.map(([group, groupItems]) => (
            <Group key={group} title={group} items={groupItems} isLight={isLight} />
          ))}
        </div>
      ) : (
        <div className={`flex min-h-[220px] items-center justify-center rounded-xl border border-dashed px-4 text-center text-[13px] leading-relaxed ${
          isLight
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-[#2a3336] bg-white/[0.03] text-slate-400"
        }`}>
          평가금액 비중 2% 이상인 보유종목이 없어 트리맵을 표시할 수 없습니다.
        </div>
      )}
    </div>
  );
}
