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
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between text-left">
        <span>
          <span className="block text-[15px] font-bold text-slate-200">전체 배당 일정 preview</span>
          <span className="text-[12px] text-slate-400">mock 일정만 접이식 표로 확인합니다.</span>
        </span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-slate-300">{open ? "접기" : "펼치기"}</span>
      </button>
      {open && (
        <div className="mt-4 overflow-auto">
          <table className="w-full min-w-[760px] text-[12.5px]">
            <thead>
              <tr className="border-b border-[#2a3336] text-left text-slate-400">
                <th className="px-3 py-2 font-medium">종목</th>
                <th className="px-3 py-2 font-medium">타입</th>
                <th className="px-3 py-2 font-medium">Ex-Div</th>
                <th className="px-3 py-2 font-medium">Buy By</th>
                <th className="px-3 py-2 font-medium">Pay</th>
                <th className="px-3 py-2 text-right font-medium">예상 금액</th>
                <th className="px-3 py-2 font-medium">상태</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} onClick={() => onOpenEvent(row)} className="cursor-pointer border-b border-[#20282a] hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5 font-bold text-white">{row.favorite ? `${row.favorite} ` : ""}{row.ticker}</td>
                  <td className="px-3 py-2.5"><span className={`rounded-md border px-2 py-1 text-[11px] ${EVENT_VISUALS[row.type].bg} ${EVENT_VISUALS[row.type].border} ${EVENT_VISUALS[row.type].text}`}>{EVENT_VISUALS[row.type].label}</span></td>
                  <td className="num px-3 py-2.5 text-slate-300">{row.exDivDate}</td>
                  <td className="num px-3 py-2.5 text-slate-300">{row.buyDeadline}</td>
                  <td className="num px-3 py-2.5 text-slate-300">{row.paymentDate}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">${row.dividendAmount?.toFixed(2) ?? "—"}</td>
                  <td className="px-3 py-2.5 text-slate-300">{eventStatusLabel(row.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
