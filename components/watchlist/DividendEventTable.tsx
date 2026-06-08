"use client";

import { EVENT_META } from "@/lib/mock-dividend-data";
import type { DividendEvent } from "@/lib/mock-dividend-data";

interface Props {
  events: DividendEvent[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function badgeStyle(color: string, border: string): { background: string; borderColor: string } {
  return { background: `${color}22`, borderColor: border };
}

// 일정 리스트 (날짜/티커/이벤트/예상·확정/배당금/현재가/배당률)
export default function DividendEventTable({ events }: Props) {
  return (
    <div className={card}>
      <h2 className="mb-4 text-[15px] font-bold text-slate-300">일정 리스트</h2>
      <div className="scroll-dark max-h-[420px] overflow-auto">
        <table className="w-full min-w-[680px] text-[13px]">
          <thead className="sticky top-0 bg-[#191f20]">
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="px-3 py-2 font-medium">날짜</th>
              <th className="px-3 py-2 font-medium">티커</th>
              <th className="px-3 py-2 font-medium">이벤트</th>
              <th className="px-3 py-2 font-medium">구분</th>
              <th className="px-3 py-2 text-right font-medium">배당금($)</th>
              <th className="px-3 py-2 text-right font-medium">현재가($)</th>
              <th className="px-3 py-2 text-right font-medium">예상 배당률</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  표시할 일정이 없습니다.
                </td>
              </tr>
            )}
            {events.map((ev) => {
              const meta = EVENT_META[ev.type];
              return (
                <tr key={ev.id} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                  <td className="num px-3 py-2.5 text-slate-300">{ev.date}</td>
                  <td className="px-3 py-2.5 font-semibold text-white">{ev.ticker}</td>
                  <td className="px-3 py-2.5">
                    <span
                      className="rounded-md border px-2 py-0.5 text-[11.5px] font-medium text-white"
                      style={badgeStyle(meta.color, meta.border)}
                    >
                      {meta.labelKo}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-300">{ev.estimated ? "예상" : "확정"}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{ev.amount != null ? ev.amount.toFixed(2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{ev.price != null ? ev.price.toFixed(2) : "—"}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{ev.annualYieldPct != null ? `${ev.annualYieldPct.toFixed(2)}%` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
