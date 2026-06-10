"use client";

import { eventStatusLabel, EVENT_VISUALS } from "@/lib/event-visuals";
import type { CalendarEvent } from "@/lib/mock-calendar-data";

interface Props {
  event: CalendarEvent | null;
  onClose: () => void;
}

export default function CalendarEventDialog({ event, onClose }: Props) {
  if (!event) return null;
  const visual = EVENT_VISUALS[event.type];
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-3xl border border-[#344044] bg-[#151b1d] p-5 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className={`mb-2 inline-flex rounded-md border px-2 py-1 text-[12px] font-bold ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</p>
            <h2 className="text-[24px] font-extrabold text-white">{event.favorite ? `${event.favorite} ` : ""}{event.ticker}</h2>
            <p className="text-[13px] text-slate-400">상태: {eventStatusLabel(event.status)}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-slate-200 hover:bg-white/15">닫기</button>
        </div>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Info label="Dividend Amount" value={event.dividendAmount == null ? "—" : `$${event.dividendAmount.toFixed(2)}`} />
          <Info label="Buy Deadline" value={event.buyDeadline} />
          <Info label="Ex-Div Date" value={event.exDivDate} />
          <Info label="Payment Date" value={event.paymentDate} />
          <Info label="Annual Yield" value={`${event.annualYield.toFixed(2)}%`} />
          <Info label="예상 절세액($10k 기준)" value={`$${event.taxSavingUsd.toFixed(1)}`} />
        </dl>
        <label className="mt-4 block text-[13px] font-semibold text-slate-300" htmlFor="calendar-note">메모</label>
        <textarea id="calendar-note" placeholder="메모 입력칸 (저장되지 않음)" className="mt-2 h-24 w-full resize-none rounded-xl border border-[#303b3f] bg-[#0f1415] p-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600" />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#273235] bg-[#101719] p-3">
      <dt className="text-[11px] uppercase tracking-[0.12em] text-slate-500">{label}</dt>
      <dd className="mt-1 text-[14px] font-bold text-slate-100">{value}</dd>
    </div>
  );
}
