"use client";

import { CalendarClock } from "lucide-react";
import { MOCK_ECONOMIC_EVENTS } from "@/lib/mock-dividend-data";
import type { EconomicEvent } from "@/lib/mock-dividend-data";

interface Props {
  events?: EconomicEvent[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

const IMPORTANCE_LABEL: Record<EconomicEvent["importance"], string> = {
  high: "중요",
  medium: "보통",
  low: "낮음",
};

const IMPORTANCE_COLOR: Record<EconomicEvent["importance"], string> = {
  high: "text-red-400",
  medium: "text-amber-400",
  low: "text-slate-400",
};

// 미국 주요 경제일정 미니 섹션. TODO(codex): GitHub Actions JSON 연결.
export default function EconomicCalendarMini({ events = MOCK_ECONOMIC_EVENTS }: Props) {
  return (
    <div className={card}>
      <div className="mb-4 flex items-center gap-2">
        <CalendarClock size={16} className="text-blue-400" />
        <h2 className="text-[15px] font-bold text-slate-300">경제 일정</h2>
        <span className="ml-auto text-[11px] text-slate-500">mock</span>
      </div>
      <ul className="flex flex-col gap-2">
        {events.map((ev, i) => (
          <li key={i} className="flex items-center gap-3 rounded-lg bg-[#11181a] px-3 py-2">
            <span className="num w-[84px] shrink-0 text-[12px] text-slate-400">{ev.date}</span>
            <span className="flex-1 text-[13px] text-slate-200">{ev.title}</span>
            <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-slate-400">{ev.country}</span>
            <span className={`shrink-0 text-[11.5px] font-medium ${IMPORTANCE_COLOR[ev.importance]}`}>
              {IMPORTANCE_LABEL[ev.importance]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
