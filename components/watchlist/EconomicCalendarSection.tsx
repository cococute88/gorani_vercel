"use client";

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import {
  formatEconomicEventDate,
  formatEconomicUpdatedAt,
  splitEconomicEventsByWeek,
  type EconomicImportance,
  type EconomicCalendarWeek,
} from "@/lib/economic-calendar-data";

// Explicit light/dark pairs (not bare dark hexes) so light mode keeps strong
// contrast: white-ish card, dark slate text, saturated blue time / importance.
const IMPORTANCE_VISUAL: Record<EconomicImportance, { label: string; cls: string }> = {
  high: { label: "중요", cls: "border-red-300 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-300" },
  medium: { label: "보통", cls: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-500/15 dark:text-amber-300" },
  low: { label: "낮음", cls: "border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-400/30 dark:bg-slate-500/15 dark:text-slate-400" },
};

// Each card caps its height; on desktop the two cards stretch to equal height, so the
// longer week scrolls internally while the shorter week stays static (no overflow).
const WEEK_CARD_CLASS =
  "flex max-h-[300px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-[#263134] dark:bg-[#141a1b] lg:max-h-[360px]";

function WeekTable({ week }: { week: EconomicCalendarWeek }) {
  return (
    <div className={WEEK_CARD_CLASS}>
      <div className="flex shrink-0 items-baseline justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-[#232d30] sm:px-4">
        <span className="text-[13px] font-bold text-slate-900 dark:text-slate-200 sm:text-[14px]">{week.label}</span>
        <span className="num text-[11px] text-slate-500 dark:text-slate-500 sm:text-[12px]">{week.rangeLabel}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {week.events.length === 0 ? (
          <p className="px-3 py-8 text-center text-[12px] text-slate-500 dark:text-slate-500 sm:text-[13px]">표시할 경제 일정이 없습니다.</p>
        ) : (
          <table className="w-full text-[11.5px] sm:text-[12.5px]">
            <tbody>
              {week.events.map((event, index) => {
                const importance = IMPORTANCE_VISUAL[event.importance];
                return (
                  <tr key={`${event.date}-${event.time}-${index}`} className="border-b border-slate-200 last:border-0 dark:border-[#20282a]">
                    <td className="num whitespace-nowrap px-3 py-2 align-top text-slate-500 dark:text-slate-400 sm:px-4 sm:py-2.5">
                      {formatEconomicEventDate(event.date)}
                    </td>
                    <td className="num whitespace-nowrap px-1 py-2 align-top font-semibold text-blue-600 dark:text-blue-300 sm:py-2.5">{event.time}</td>
                    <td className="px-2 py-2 align-top font-medium text-slate-800 dark:text-slate-200 sm:px-3 sm:py-2.5">{event.name}</td>
                    <td className="px-1 py-2 pr-3 text-right align-top sm:py-2.5 sm:pr-4">
                      <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium ${importance.cls}`}>
                        {importance.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Full-width "주요 미국 경제 일정" section. Mirrors the original Streamlit
// render_us_economic_calendar_section, split into this-week / next-week tables.
export default function EconomicCalendarSection() {
  const weeks = useMemo(() => splitEconomicEventsByWeek(), []);

  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <div className="mb-1 flex items-center gap-2">
        <CalendarClock size={16} className="text-blue-500 dark:text-blue-400" />
        <h2 className="text-[14px] font-bold text-slate-900 dark:text-slate-200 sm:text-[15px]">주요 미국 경제 일정</h2>
        <span className="ml-auto rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-white/10 dark:text-slate-400 sm:text-[11px]">static</span>
      </div>
      <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-400 sm:text-[12px]">이번주·다음주 중요도 높은 미국 경제지표 일정입니다.</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <WeekTable week={weeks.thisWeek} />
        <WeekTable week={weeks.nextWeek} />
      </div>
      <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-500 sm:text-[11px]">
        마지막 업데이트: {formatEconomicUpdatedAt(weeks.updatedAt)} · 원본 Streamlit 정적 스냅샷
      </p>
    </section>
  );
}
