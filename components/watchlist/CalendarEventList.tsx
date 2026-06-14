"use client";

import { lookupTickerMemo } from "@/lib/calendar-memo-matching";
import {
  eventChipLabel,
  eventStateClasses,
  eventStatusShortLabel,
  formatTaxSavingPer10k,
  getEventVisual,
} from "@/lib/event-visuals";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

// Per-ticker tax-saving estimate (현시세 기준 · 만달러당). Supplied by the page from
// the same `buildTaxSavingRows` result the right-rail 절세액 table uses — keyed by
// the uppercase ticker. `null`/missing → the card shows "—" (never fabricated).
export type TaxSavingByTicker = Record<string, { taxSavingUsd: number; canCalculate: boolean; isLoading?: boolean } | undefined>;

interface Props {
  title: string;
  events: CalendarEvent[];
  todayIso: string;
  emptyText?: string;
  onOpenEvent: (event: CalendarEvent) => void;
  // Optional per-$10k tax-saving estimates by ticker (현시세 기준).
  taxSavingByTicker?: TaxSavingByTicker;
  // Optional ticker→memo map (legacy/imported 종목 메모). When a memo is present it
  // is shown next to the ticker on wide screens / below it on mobile; absent memos
  // render nothing (no empty-state placeholder text). The matching/source wiring
  // itself is out of scope — see CALENDAR-MEMO-SOURCE-FIX-1 TODO in docs.
  tickerMemos?: Record<string, string>;
}

function resolveTaxSavingLabel(
  event: CalendarEvent,
  taxSavingByTicker?: TaxSavingByTicker,
): string {
  const row = taxSavingByTicker?.[event.ticker.trim().toUpperCase()];
  if (!row || row.isLoading || !row.canCalculate) return "—";
  return formatTaxSavingPer10k(row.taxSavingUsd);
}

function resolveCardMemo(event: CalendarEvent, tickerMemos?: Record<string, string>): string {
  const tickerMemo = tickerMemos ? lookupTickerMemo(tickerMemos, event.ticker) : "";
  if (tickerMemo) return tickerMemo;
  return event.note?.trim() ?? "";
}

export default function CalendarEventList({
  title,
  events,
  todayIso,
  emptyText = "표시할 배당 일정이 없습니다.",
  onOpenEvent,
  taxSavingByTicker,
  tickerMemos,
}: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <h2 className="mb-2 text-[14px] font-bold text-slate-700 dark:text-slate-200 sm:mb-3 sm:text-[15px]">{title}</h2>
      <div className="space-y-1.5 sm:space-y-2">
        {events.length === 0 && <p className="rounded-xl border border-dashed border-[#334044] px-3 py-5 text-center text-[12px] text-slate-500 sm:px-4 sm:py-6 sm:text-[13px]">{emptyText}</p>}
        {events.map((event) => {
          const visual = getEventVisual(event.type);
          const taxLabel = resolveTaxSavingLabel(event, taxSavingByTicker);
          const statusLabel = eventStatusShortLabel(event.status);
          const memo = resolveCardMemo(event, tickerMemos);
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event)}
              // Light mode: white base, faint sky tint on hover/focus (never the
              // dark surface color, which the global light remap leaves untouched
              // on hover:/focus: variants and would otherwise flash near-black).
              // Dark mode keeps the existing dark card tones.
              className="flex w-full items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-colors hover:border-sky-200 hover:bg-sky-50 focus:outline-none focus-visible:border-sky-300 focus-visible:bg-sky-50 focus-visible:ring-2 focus-visible:ring-sky-200 dark:border-[#263134] dark:bg-[#141a1b] dark:hover:border-[#2f4147] dark:hover:bg-[#1d2527] dark:focus-visible:bg-[#1d2527] dark:focus-visible:ring-sky-500/30 sm:gap-3 sm:p-3"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                {/* Left block: ticker/type badge + date · tax · status line (+ mobile memo) */}
                <span className="flex min-w-0 flex-col gap-1 sm:w-[168px] sm:shrink-0">
                  <span className={`inline-flex max-w-full truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold sm:px-2 sm:py-1 sm:text-[11px] ${visual.bg} ${visual.border} ${visual.text} ${eventStateClasses(event, todayIso)}`}>
                    {event.favorite ? `${event.favorite} ` : ""}{eventChipLabel(event)}
                  </span>
                  <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400 sm:text-[12px]">
                    {event.date} · {taxLabel} · {statusLabel}
                  </span>
                  {memo && (
                    <span className="line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400 sm:hidden">
                      {memo}
                    </span>
                  )}
                </span>
                {/* Wide screens: ticker memo fills the empty space to the right of the badge */}
                {memo && (
                  <span className="hidden min-w-0 flex-1 self-center text-[12px] leading-snug text-slate-500 line-clamp-2 dark:text-slate-400 sm:block">
                    {memo}
                  </span>
                )}
              </span>
              <span className="shrink-0 self-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-400 sm:px-2 sm:py-1 sm:text-[11px]">{statusLabel}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
