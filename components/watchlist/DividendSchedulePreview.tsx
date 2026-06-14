"use client";

import { useMemo, useState } from "react";
import { eventStatusLabel, getEventVisual } from "@/lib/event-visuals";
import type { CalendarEvent, CalendarEventStatus } from "@/lib/mock-calendar-data";

// "전체 배당 일정" master table. Mirrors the original Streamlit
// `_events_to_dataframe` / "전체 배당 일정 (All Tickers, 1 Year)" expander: one
// row per event with a type filter, sortable columns, and a capped 12-row
// scroll area. Custom/user events are intentionally excluded here (they always
// render on the calendar grid instead).

type TableEventType = "ex_div" | "buy_by" | "pay" | "earnings";
type SortColumn = "ticker" | "type" | "status" | "dividend" | "buyBy" | "exDiv" | "payment";
type SortDir = "asc" | "desc";

interface Props {
  events: CalendarEvent[];
  monthStartIso: string;
  monthEndIso: string;
  onOpenEvent: (event: CalendarEvent) => void;
}

type ScheduleRow = {
  event: CalendarEvent;
  ticker: string;
  favorite?: CalendarEvent["favorite"];
  type: TableEventType;
  status: CalendarEventStatus;
  dividend: number | null;
  buyBy: string;
  exDiv: string;
  payment: string;
  sortDate: string;
};

const TABLE_TYPES: TableEventType[] = ["ex_div", "buy_by", "pay", "earnings"];
const TYPE_RANK: Record<TableEventType, number> = { ex_div: 0, buy_by: 1, pay: 2, earnings: 3 };

const COLUMNS: { key: SortColumn; label: string; align?: "right"; hideOnMobile?: boolean }[] = [
  { key: "ticker", label: "종목" },
  { key: "type", label: "타입" },
  { key: "status", label: "상태", hideOnMobile: true },
  { key: "dividend", label: "배당금", align: "right" },
  { key: "buyBy", label: "매수마감일", hideOnMobile: true },
  { key: "exDiv", label: "배당락일" },
  { key: "payment", label: "지급일", hideOnMobile: true },
];

const DASH = "—";

function toScheduleRow(event: CalendarEvent): ScheduleRow | null {
  const type = event.type;
  if (type !== "ex_div" && type !== "buy_by" && type !== "pay" && type !== "earnings") return null;

  if (type === "earnings") {
    // Earnings rows carry only ticker/type/status/date — never dividend/buy/pay.
    return {
      event,
      ticker: event.ticker,
      favorite: event.favorite,
      type,
      status: event.status,
      dividend: null,
      buyBy: "",
      exDiv: event.date || event.exDivDate || "",
      payment: "",
      sortDate: event.date || event.exDivDate || "",
    };
  }

  return {
    event,
    ticker: event.ticker,
    favorite: event.favorite,
    type,
    status: event.status,
    dividend: event.dividendAmount,
    buyBy: event.buyDeadline || "",
    exDiv: event.exDivDate || "",
    payment: event.paymentDate || "",
    sortDate: event.date || event.exDivDate || "",
  };
}

function compareNullableNumber(a: number | null, b: number | null, sign: number): number {
  const aMissing = a == null;
  const bMissing = b == null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1; // missing always sinks to the bottom
  if (bMissing) return -1;
  return sign * (a - b);
}

function compareDateString(a: string, b: string, sign: number): number {
  const aMissing = !a;
  const bMissing = !b;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return sign * a.localeCompare(b);
}

function monthDistance(dateIso: string, monthStartIso: string, monthEndIso: string): number {
  if (!dateIso) return Number.POSITIVE_INFINITY;
  if (dateIso >= monthStartIso && dateIso <= monthEndIso) return 0;
  const start = new Date(`${monthStartIso}T00:00:00`).getTime();
  const end = new Date(`${monthEndIso}T00:00:00`).getTime();
  const value = new Date(`${dateIso.slice(0, 10)}T00:00:00`).getTime();
  if (!Number.isFinite(value)) return Number.POSITIVE_INFINITY;
  return Math.min(Math.abs(value - start), Math.abs(value - end));
}

function formatDividend(value: number | null): string {
  return value == null ? DASH : `$${value.toFixed(2)}`;
}

export default function DividendSchedulePreview({ events, monthStartIso, monthEndIso, onOpenEvent }: Props) {
  const [open, setOpen] = useState(true);
  const [typeFilter, setTypeFilter] = useState<Record<TableEventType, boolean>>({
    ex_div: true,
    buy_by: true,
    pay: true,
    earnings: true,
  });
  const [sort, setSort] = useState<{ column: SortColumn | null; dir: SortDir }>({ column: null, dir: "asc" });

  const allRows = useMemo(
    () => events.map(toScheduleRow).filter((row): row is ScheduleRow => Boolean(row)),
    [events],
  );

  const visibleRows = useMemo(() => {
    const filtered = allRows.filter((row) => typeFilter[row.type]);
    const sign = sort.dir === "asc" ? 1 : -1;

    const byDefault = (a: ScheduleRow, b: ScheduleRow): number => {
      const distA = monthDistance(a.sortDate, monthStartIso, monthEndIso);
      const distB = monthDistance(b.sortDate, monthStartIso, monthEndIso);
      return (
        distA - distB ||
        a.sortDate.localeCompare(b.sortDate) ||
        a.ticker.localeCompare(b.ticker) ||
        TYPE_RANK[a.type] - TYPE_RANK[b.type]
      );
    };

    const byColumn = (a: ScheduleRow, b: ScheduleRow): number => {
      let primary = 0;
      switch (sort.column) {
        case "ticker":
          primary = sign * a.ticker.localeCompare(b.ticker);
          break;
        case "type":
          primary = sign * (TYPE_RANK[a.type] - TYPE_RANK[b.type]);
          break;
        case "status":
          primary = sign * a.status.localeCompare(b.status);
          break;
        case "dividend":
          primary = compareNullableNumber(a.dividend, b.dividend, sign);
          break;
        case "buyBy":
          primary = compareDateString(a.buyBy, b.buyBy, sign);
          break;
        case "exDiv":
          primary = compareDateString(a.exDiv, b.exDiv, sign);
          break;
        case "payment":
          primary = compareDateString(a.payment, b.payment, sign);
          break;
        default:
          primary = 0;
      }
      return primary || a.sortDate.localeCompare(b.sortDate) || a.ticker.localeCompare(b.ticker);
    };

    return [...filtered].sort(sort.column ? byColumn : byDefault);
  }, [allRows, typeFilter, sort, monthStartIso, monthEndIso]);

  const toggleSort = (column: SortColumn) => {
    setSort((current) =>
      current.column === column
        ? { column, dir: current.dir === "asc" ? "desc" : "asc" }
        : { column, dir: "asc" },
    );
  };

  const sortIndicator = (column: SortColumn): string => {
    if (sort.column !== column) return "↕";
    return sort.dir === "asc" ? "▲" : "▼";
  };

  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[14px] font-bold text-slate-800 dark:text-slate-200 sm:text-[15px]">전체 배당 일정</span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 sm:text-[12px]">종목별 모든 일정 (현재 월 우선 정렬)</span>
        </span>
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300 sm:text-[12px]">{open ? "접기" : "펼치기"}</span>
      </button>

      {open && (
        <div className="mt-3 sm:mt-4">
          {/* Event type filter (default all checked) */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5 sm:gap-2">
            {TABLE_TYPES.map((type) => {
              const visual = getEventVisual(type);
              const active = typeFilter[type];
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTypeFilter((current) => ({ ...current, [type]: !current[type] }))}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition sm:text-[12px] ${active ? `${visual.bg} ${visual.border} ${visual.text}` : "border-slate-300 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5 dark:text-slate-500"}`}
                >
                  <span aria-hidden>{active ? "☑" : "☐"}</span>
                  {visual.label}
                </button>
              );
            })}
            <span className="ml-auto text-[11px] text-slate-500 dark:text-slate-400 sm:text-[12px]">총 {visibleRows.length.toLocaleString()}건</span>
          </div>

          {/* 12-row scroll body with sticky header */}
          <div className="max-h-[460px] overflow-auto rounded-xl border border-[#20282a]">
            <table className="w-full min-w-[520px] text-[11.5px] sm:text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#141a1b]">
                <tr className="text-left text-slate-600 dark:text-slate-300">
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className={`whitespace-nowrap px-2 py-2 font-semibold sm:px-3 ${col.align === "right" ? "text-right" : ""} ${col.hideOnMobile ? "hidden sm:table-cell" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white ${col.align === "right" ? "flex-row-reverse" : ""}`}
                      >
                        {col.label}
                        <span className={`text-[9px] ${sort.column === col.key ? "text-blue-600 dark:text-blue-300" : "text-slate-400 dark:text-slate-600"}`}>{sortIndicator(col.key)}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="py-6 text-center text-slate-500 dark:text-slate-400">
                      표시할 일정이 없습니다.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row) => {
                  const visual = getEventVisual(row.type);
                  return (
                    <tr
                      key={row.event.id}
                      onClick={() => onOpenEvent(row.event)}
                      className="cursor-pointer border-t border-[#20282a] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
                    >
                      <td className="whitespace-nowrap px-2 py-2 font-bold text-slate-900 dark:text-white sm:px-3">
                        {row.favorite ? `${row.favorite} ` : ""}{row.ticker}
                      </td>
                      <td className="px-2 py-2 sm:px-3">
                        <span className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-300 sm:table-cell sm:px-3">{eventStatusLabel(row.status)}</td>
                      <td className="num whitespace-nowrap px-2 py-2 text-right text-slate-700 dark:text-slate-200 sm:px-3">{formatDividend(row.dividend)}</td>
                      <td className="num hidden whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-300 sm:table-cell sm:px-3">{row.buyBy || DASH}</td>
                      <td className="num whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-300 sm:px-3">{row.exDiv || DASH}</td>
                      <td className="num hidden whitespace-nowrap px-2 py-2 text-slate-600 dark:text-slate-300 sm:table-cell sm:px-3">{row.payment || DASH}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
