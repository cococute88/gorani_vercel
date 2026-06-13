"use client";

import { useEffect, useState } from "react";
import { eventStatusLabel, getEventVisual } from "@/lib/event-visuals";
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

  const canonicalEventId = event?.canonicalEventId ?? event?.id;

  useEffect(() => {
    setMemo(meta?.memo ?? event?.note ?? "");
  }, [canonicalEventId, event?.note, meta?.memo]);

  if (!event) return null;
  const visual = getEventVisual(event.type);
  const star = meta?.star ?? false;
  const heart = meta?.heart ?? false;

  const saveMeta = (patch: Partial<CalendarEventMeta>) => {
    const targetEventId = event.canonicalEventId ?? event.id;
    onSaveMeta(event, {
      ...meta,
      eventId: targetEventId,
      canonicalEventId: targetEventId,
      ticker: event.ticker,
      sourceKind: event.sourceKind ?? meta?.sourceKind,
      star,
      heart,
      memo,
      ...patch,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#344044] bg-[#151b1d] p-4 shadow-2xl sm:max-w-lg sm:p-5" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>
              {event.status === "estimated" && (
                <span className="rounded border border-dashed border-yellow-400/40 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-medium text-yellow-300">추정</span>
              )}
            </div>
            <h2 className="truncate text-[20px] font-extrabold text-white sm:text-[24px]">{event.favorite ? `${event.favorite} ` : ""}{event.title ?? event.ticker}</h2>
            <p className="mt-0.5 text-[12px] text-slate-400">{event.date} · {eventStatusLabel(event.status)}</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-slate-300 hover:bg-white/15">✕</button>
        </div>

        {/* Star / Heart */}
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => saveMeta({ star: !star })} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition sm:text-[13px] ${star ? "border-yellow-300/40 bg-yellow-400/15 text-yellow-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"}`}>⭐ 별</button>
          <button type="button" onClick={() => saveMeta({ heart: !heart })} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition sm:text-[13px] ${heart ? "border-pink-300/40 bg-pink-400/15 text-pink-200" : "border-white/10 bg-white/5 text-slate-400 hover:text-slate-200"}`}>💗 하트</button>
        </div>

        {/* Info grid */}
        <dl className="grid grid-cols-2 gap-2">
          <Info label="배당금" value={event.dividendAmount == null ? "—" : `$${event.dividendAmount.toFixed(2)}`} />
          <Info label="매수마감" value={event.buyDeadline || "—"} />
          <Info label="배당락일" value={event.exDivDate || "—"} />
          <Info label="지급일" value={event.paymentDate || "—"} />
          <Info label="연간 수익률" value={`${event.annualYield.toFixed(2)}%`} />
          <Info label="절세액($10k)" value={`$${event.taxSavingUsd.toFixed(1)}`} />
        </dl>

        {/* Source info */}
        {event.sourceKind && (
          <p className="mt-3 text-[11px] text-slate-500">데이터: {event.sourceKind === "estimated" ? "추정(과거 패턴 기반)" : event.sourceKind}</p>
        )}

        {/* Memo */}
        <label className="mt-4 block text-[12px] font-semibold text-slate-300 sm:text-[13px]" htmlFor="calendar-note">메모</label>
        <textarea id="calendar-note" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모를 입력하세요" className="mt-1.5 h-20 w-full resize-none rounded-xl border border-[#303b3f] bg-[#0f1415] p-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-blue-500/50 sm:h-24" />
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={() => saveMeta({ memo })} className="rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-500 sm:text-[13px]">저장</button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#273235] bg-[#101719] p-2.5 sm:p-3">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500 sm:text-[11px]">{label}</dt>
      <dd className="mt-0.5 truncate text-[13px] font-bold text-slate-100 sm:text-[14px]">{value}</dd>
    </div>
  );
}
