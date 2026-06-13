"use client";

import { useEffect, useState } from "react";
import { getEventVisual } from "@/lib/event-visuals";
import type { CalendarCustomEvent } from "@/lib/calendar-custom-events";

export type CustomEventSubmitInput = {
  id?: string;
  createdAt?: string;
  title: string;
  date: string;
  ticker?: string;
  note?: string;
};

interface Props {
  open: boolean;
  /** When provided, the dialog is in edit mode for this custom event. */
  event: CalendarCustomEvent | null;
  /** Fallback date used for new events (selected date or today). */
  defaultDate: string;
  onClose: () => void;
  onSubmit: (input: CustomEventSubmitInput) => void;
  onDelete: (eventId: string) => void;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default function CustomEventDialog({ open, event, defaultDate, onClose, onSubmit, onDelete }: Props) {
  const isEdit = Boolean(event);
  const visual = getEventVisual("custom");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [ticker, setTicker] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? "");
    setDate(event?.date ?? defaultDate);
    setTicker(event?.ticker ?? "");
    setNote(event?.note ?? "");
    setError("");
    setConfirmDelete(false);
  }, [open, event, defaultDate]);

  if (!open) return null;

  const handleSave = () => {
    const trimmedTitle = title.trim();
    const trimmedDate = date.trim();
    if (!trimmedTitle) {
      setError("일정 제목을 입력하세요.");
      return;
    }
    if (!ISO_DATE_PATTERN.test(trimmedDate)) {
      setError("날짜를 YYYY-MM-DD 형식으로 입력하세요.");
      return;
    }
    onSubmit({
      id: event?.id,
      createdAt: event?.createdAt,
      title: trimmedTitle,
      date: trimmedDate,
      ticker: ticker.trim().toUpperCase() || undefined,
      note: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-[#344044] bg-[#151b1d] p-4 shadow-2xl sm:max-w-lg sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${visual.bg} ${visual.border} ${visual.text}`}>{visual.label}</span>
            <h2 className="mt-2 text-[20px] font-extrabold text-white sm:text-[24px]">{isEdit ? "일정 수정" : "커스텀 일정 추가"}</h2>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-slate-300 hover:bg-white/15">✕</button>
        </div>

        {/* Fields */}
        <div className="space-y-3">
          <Field label="일정 제목" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 실적 발표, 매수 예정일"
              className="w-full rounded-xl border border-[#303b3f] bg-[#0f1415] px-3 py-2.5 text-[14px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
            />
          </Field>

          <Field label="날짜" required>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-[#303b3f] bg-[#0f1415] px-3 py-2.5 text-[14px] text-slate-200 outline-none focus:border-amber-400/50 [color-scheme:dark]"
            />
          </Field>

          <Field label="티커 (선택)">
            <input
              type="text"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="예: SCHD"
              className="w-full rounded-xl border border-[#303b3f] bg-[#0f1415] px-3 py-2.5 text-[14px] uppercase text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50"
            />
          </Field>

          <Field label="메모 (선택)">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="메모를 입력하세요"
              className="h-20 w-full resize-none rounded-xl border border-[#303b3f] bg-[#0f1415] p-3 text-[13px] text-slate-200 outline-none placeholder:text-slate-600 focus:border-amber-400/50 sm:h-24"
            />
          </Field>
        </div>

        {error && <p className="mt-3 text-[12px] font-semibold text-red-300">{error}</p>}

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          {isEdit && event ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-slate-300">삭제할까요?</span>
                <button type="button" onClick={() => onDelete(event.id)} className="rounded-lg bg-red-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-red-500">삭제</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg bg-white/10 px-3 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/15">취소</button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-red-200 hover:bg-red-500/20">삭제</button>
            )
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-4 py-2 text-[12px] font-semibold text-slate-300 hover:bg-white/15 sm:text-[13px]">취소</button>
            <button type="button" onClick={handleSave} className="rounded-lg bg-amber-500 px-4 py-2 text-[12px] font-semibold text-slate-900 hover:bg-amber-400 sm:text-[13px]">저장</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-300 sm:text-[13px]">
        {label}
        {required && <span className="ml-0.5 text-amber-300">*</span>}
      </span>
      {children}
    </label>
  );
}
