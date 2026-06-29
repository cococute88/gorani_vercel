"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, RefreshCw } from "lucide-react";
import {
  usePortfolioRefresh,
  type PortfolioRefreshOutcome,
} from "@/lib/portfolio-firestore-snapshot-sync";

type Props = {
  /**
   * All snapshot dates available for selection (YYYY-MM-DD), newest first.
   * Today there is typically a single date, but the dropdown is intentionally
   * built to scale: as more Firestore snapshots accumulate, callers only need
   * to feed a longer list here — no UI change required.
   */
  snapshotDates?: string[];
  /** Active snapshot date currently driving the Portfolio screen (YYYY-MM-DD). */
  snapshotDate: string | null;
  /**
   * Optional handler invoked when the user picks a different snapshot date.
   * Selection wiring is not required yet (only one snapshot exists today); the
   * dropdown keeps its own selected state so the UI is ready for the future.
   */
  onSelectSnapshotDate?: (date: string) => void;
  theme?: "dark" | "light";
};

type Tone = "success" | "info" | "error";

type ResultMessage = { tone: Tone; text: string };

// Result text shown to the user after a manual "최신화" (requirement 8).
const MESSAGES: Record<PortfolioRefreshOutcome, ResultMessage> = {
  updated: { tone: "success", text: "최신 데이터로 업데이트되었습니다." },
  unchanged: { tone: "info", text: "이미 최신 데이터입니다." },
  error: {
    tone: "error",
    text: "최신 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
  },
};

// How long the result message stays before auto-dismissing.
const MESSAGE_TIMEOUT_MS = 4000;

function messageToneClass(tone: Tone, isLight: boolean): string {
  if (tone === "success") {
    return isLight ? "text-emerald-600" : "text-emerald-300";
  }
  if (tone === "error") {
    return isLight ? "text-rose-600" : "text-rose-300";
  }
  return isLight ? "text-slate-500" : "text-slate-400";
}

// 포트폴리오 관리 상단 "현재 스냅샷" 선택 드롭다운 + 수동 "최신화" 버튼.
// 자동 폴링 없이 사용자가 버튼을 눌렀을 때만 Firestore 최신 스냅샷을 다시 조회한다.
export default function PortfolioSyncControl({
  snapshotDates,
  snapshotDate,
  onSelectSnapshotDate,
  theme = "light",
}: Props) {
  const isLight = theme === "light";
  const { isRefreshing, refresh } = usePortfolioRefresh();
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dropdown options: always include the active date so the control renders a
  // valid selection even before any history list is supplied.
  const options = (() => {
    const list = snapshotDates && snapshotDates.length > 0 ? [...snapshotDates] : [];
    if (snapshotDate && !list.includes(snapshotDate)) list.unshift(snapshotDate);
    return list;
  })();

  // Locally tracked selection. Defaults to the active snapshot date and follows
  // it whenever the active snapshot changes (e.g. after a successful 최신화).
  const [selectedDate, setSelectedDate] = useState<string | null>(snapshotDate);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectedDate(snapshotDate);
  }, [snapshotDate]);

  // Close the dropdown on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const handleSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      setOpen(false);
      onSelectSnapshotDate?.(date);
    },
    [onSelectSnapshotDate],
  );

  const handleClick = useCallback(async () => {
    if (isRefreshing) return; // double-click guard (UI side; hook guards too)
    clearTimer();
    setMessage(null);

    const outcome = await refresh();
    setMessage(MESSAGES[outcome]);

    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, MESSAGE_TIMEOUT_MS);
  }, [isRefreshing, refresh, clearTimer]);

  const labelCls = isLight ? "text-slate-400" : "text-slate-500";

  const triggerCls = isLight
    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    : "border-[#2a3336] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]";

  const menuCls = isLight
    ? "border-slate-200 bg-white text-slate-700 shadow-lg"
    : "border-[#2a3336] bg-[#171d1e] text-slate-200 shadow-2xl";

  const optionHoverCls = isLight ? "hover:bg-slate-100" : "hover:bg-white/[0.06]";

  const buttonCls = isLight
    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
    : "border-[#2a3336] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white";

  const displayDate = selectedDate ?? snapshotDate;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* 현재 스냅샷 + 확장형 드롭다운 (스냅샷이 1개여도 드롭다운 UI 유지) */}
      <div className="inline-flex items-center gap-2 text-[12px]">
        <span className={labelCls}>현재 스냅샷</span>
        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={open}
            disabled={options.length === 0}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${triggerCls}`}
          >
            <span className="num">{displayDate ?? "—"}</span>
            <ChevronDown
              size={14}
              strokeWidth={2.2}
              aria-hidden
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && options.length > 0 ? (
            <div
              role="listbox"
              aria-label="스냅샷 선택"
              className={`absolute left-0 z-30 mt-1 max-h-64 min-w-[9.5rem] overflow-auto rounded-lg border py-1 ${menuCls}`}
            >
              {options.map((date) => {
                const active = date === displayDate;
                return (
                  <button
                    key={date}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => handleSelect(date)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-[12px] font-medium tabular-nums transition-colors ${optionHoverCls}`}
                  >
                    <span className="num">{date}</span>
                    {active ? (
                      <Check size={13} strokeWidth={2.4} aria-hidden className="text-blue-500" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isRefreshing}
        aria-busy={isRefreshing}
        aria-label="최신 데이터로 최신화"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonCls}`}
      >
        {isRefreshing ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden />
            최신화 중...
          </>
        ) : (
          <>
            <RefreshCw size={14} strokeWidth={2.2} aria-hidden />
            최신화
          </>
        )}
      </button>

      {message ? (
        <span
          role="status"
          aria-live="polite"
          className={`text-[12px] font-medium ${messageToneClass(message.tone, isLight)}`}
        >
          {message.text}
        </span>
      ) : null}
    </div>
  );
}
