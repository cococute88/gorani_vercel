"use client";

import { useEffect, useState } from "react";
import { eventStatusLabel, EVENT_VISUALS } from "@/lib/event-visuals";
import type { CalendarEvent } from "@/lib/mock-calendar-data";
import type { CalendarEventMeta } from "@/lib/firebase/firestore-repositories";

interface Props {
  event: CalendarEvent | null;
  meta?: CalendarEventMeta;
  onSaveMeta: (event: CalendarEvent, meta: CalendarEventMeta) => void;
  onClose: () => void;
}

export default function CalendarEventDialog({ event, meta, onSaveMeta, onClose }: Props) {
  const [memo, setMemo] = useState("");

  useEffect(() => {
    setMemo(meta?.memo ?? event?.note ?? "");
  }, [event?.id, event?.note, meta?.memo]);

  if (!event) return null;
  const visual = EVENT_VISUALS[event.type];
  const star = meta?.star ?? false;
  const heart = meta?.heart ?? false;

  const saveMeta = (patch: Partial<CalendarEventMeta>) => {
    onSaveMeta(event, {
      eventId: event.id,
      ticker: event.ticker,
      star,
      heart,
      memo,
      ...meta,
      ...patch,
    });
  };

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
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => saveMeta({ star: !star })} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${star ? "border-yellow-300/30 bg-yellow-400/15 text-yellow-200" : "border-white/10 bg-white/5 text-slate-300"}`}>⭐ 별</button>
          <button type="button" onClick={() => saveMeta({ heart: !heart })} className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${heart ? "border-pink-300/30 bg-pink-400/15 text-pink-200" : "border-white/10 bg-white/5 text-slate-300"}`}>💗 하트</button>
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
        <textarea id="calendar-note" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하면 저장할 수 있어요." className="mt-2 h-24 w-full resize-none rounded-xl border border-[#303b3f] bg-[#0f1415] p-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600" />
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => saveMeta({ memo })} className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700">메모 저장</button>
        </div>
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
