"use client";

import { formatCompactKrw } from "@/lib/format";
import type { PortfolioTreemapItem } from "@/lib/portfolio-from-snapshots";

type Props = {
  items: PortfolioTreemapItem[];
  theme?: "dark" | "light";
};

function rateColor(rate: number | null): string {
  if (rate === null) return "#475569";
  if (rate >= 50) return "#b91c1c";
  if (rate >= 20) return "#dc2626";
  if (rate >= 5) return "#ef4444";
  if (rate >= 0) return "#7f1d1d";
  if (rate >= -5) return "#1e3a8a";
  return "#1d4ed8";
}

function Group({ title, items }: { title: string; items: PortfolioTreemapItem[] }) {
  const total = items.reduce((sum, item) => sum + item.valueKRW, 0);

  return (
    <div className="box-border flex min-w-0 w-full max-w-full flex-col">
      <div className="mb-1.5 truncate text-[12px] font-semibold text-slate-400">
        {title}
      </div>
      <div className="flex min-w-0 w-full max-w-full flex-wrap gap-1 overflow-hidden">
        {items.map((item) => {
          const pct = total > 0 ? (item.valueKRW / total) * 100 : 0;
          const tileStyle = {
            backgroundColor: rateColor(item.returnPct),
            flex: `${item.valueKRW} 1 clamp(96px, ${pct.toFixed(1)}%, 100%)`,
            minHeight: item.valueKRW >= total * 0.08 ? 78 : 58,
          };

          return (
            <div
              key={`${item.group}-${item.ticker || item.name}`}
              className="box-border flex min-w-0 max-w-full flex-col justify-between overflow-hidden rounded-md p-2 text-white"
              style={tileStyle}
              title={`${item.name}${item.ticker ? ` (${item.ticker})` : ""}`}
            >
              <span className="truncate text-[12px] font-bold leading-tight">
                {item.ticker || item.name}
              </span>
              <div className="min-w-0 leading-tight">
                <div className="num truncate text-[12px] font-extrabold">
                  {item.returnPct === null
                    ? "수익률 —"
                    : `${item.returnPct > 0 ? "+" : ""}${item.returnPct.toFixed(1)}%`}
                </div>
                <div className="num truncate text-[10px] text-white/80">
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
            <Group key={group} title={group} items={groupItems} />
          ))}
        </div>
      ) : (
        <div className={`flex min-h-[220px] items-center justify-center rounded-xl border border-dashed px-4 text-center text-[13px] leading-relaxed ${
          isLight
            ? "border-slate-200 bg-slate-50 text-slate-500"
            : "border-[#2a3336] bg-white/[0.03] text-slate-400"
        }`}>
          평가금액 필드가 있는 보유종목이 없어 트리맵을 표시하지 않습니다.
        </div>
      )}
    </div>
  );
}
