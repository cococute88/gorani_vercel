"use client";

import { useState } from "react";
import { eventStatusLabel, EVENT_VISUALS } from "@/lib/event-visuals";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

interface Props {
  events: CalendarEvent[];
  onOpenEvent: (event: CalendarEvent) => void;
}

function rowsFromEvents(events: CalendarEvent[]): CalendarEvent[] {
  const byTicker = new Map<string, CalendarEvent>();
  for (const event of events) {
    if (event.type === "ex_div" && !byTicker.has(event.ticker)) byTicker.set(event.ticker, event);
  }
  return Array.from(byTicker.values());
}

export default function DividendSchedulePreview({ events, onOpenEvent }: Props) {
  const [open, setOpen] = useState(true);
  const rows = rowsFromEvents(events);
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[14px] font-bold text-slate-200 sm:text-[15px]">전체 배당 일정</span>
          <span className="text-[11px] text-slate-400 sm:text-[12px]">종목별 배당 일정 요약</span>
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 sm:text-[12px]">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <div className="mt-3 overflow-x-auto sm:mt-4">
          <table className="w-full min-w-[600px] text-[11.5px] sm:min-w-[700px] sm:text-[12.5px]">
            <thead>
              <tr className="border-b border-[#2a3336] text-left text-slate-400">
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">종목</th>
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">타입</th>
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">배당락</th>
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">매수마감</th>
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">지급</th>
                <th className="px-2 py-1.5 text-right font-medium sm:px-3 sm:py-2">금액</th>
                <th className="px-2 py-1.5 font-medium sm:px-3 sm:py-2">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => onOpenEvent(row)} className="cursor-pointer border-b border-[#20282a] hover:bg-white/[0.03]">
                  <td className="px-2 py-2 font-bold text-white sm:px-3 sm:py-2.5">{row.favorite ? `${row.favorite} ` : ""}{row.ticker}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5"><span className={`rounded-md border px-1.5 py-0.5 text-[10px] sm:px-2 sm:py-1 sm:text-[11px] ${EVENT_VISUALS[row.type].bg} ${EVENT_VISUALS[row.type].border} ${EVENT_VISUALS[row.type].text}`}>{EVENT_VISUALS[row.type].label}</span></td>
                  <td className="num px-2 py-2 text-slate-300 sm:px-3 sm:py-2.5">{row.exDivDate}</td>
                  <td className="num px-2 py-2 text-slate-300 sm:px-3 sm:py-2.5">{row.buyDeadline}</td>
                  <td className="num px-2 py-2 text-slate-300 sm:px-3 sm:py-2.5">{row.paymentDate}</td>
                  <td className="num px-2 py-2 text-right text-slate-300 sm:px-3 sm:py-2.5">${row.dividendAmount?.toFixed(2) ?? "—"}</td>
                  <td className="px-2 py-2 text-slate-300 sm:px-3 sm:py-2.5">{eventStatusLabel(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
