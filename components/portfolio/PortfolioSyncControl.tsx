"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import {
  usePortfolioPipelineRefresh,
  type PipelineState,
} from "@/lib/portfolio-pipeline-refresh";

type Props = {
  /**
   * All snapshot dates available for selection (YYYY-MM-DD), newest first.
   * The Year/Month/Day dropdowns are derived entirely from this list (no
   * hardcoded dates): as more Firestore snapshots accumulate, callers only need
   * to feed a longer list here — no UI change required.
   */
  snapshotDates?: string[];
  /** Active snapshot date currently driving the Portfolio screen (YYYY-MM-DD). */
  snapshotDate: string | null;
  /**
   * Handler invoked when the user changes the Year, Month or Day dropdown. The
   * control is fully controlled by `snapshotDate`: every change recomputes a
   * complete valid date from the registered snapshots and reports it here so the
   * parent can update the shared active snapshot immediately.
   */
  onSelectSnapshotDate?: (date: string) => void;
  theme?: "dark" | "light";
};

type Tone = "success" | "info" | "error";

type ResultMessage = { tone: Tone; text: string };

// Map a pipeline phase/outcome to the status message shown to the user
// (requirements 2, 4, 6, 9, 10). Returns null while idle (no message).
function pipelineMessage(state: PipelineState): ResultMessage | null {
  switch (state.phase) {
    case "dispatching":
      return { tone: "info", text: "작업을 시작했습니다." };
    case "queued":
      return { tone: "info", text: "GitHub Actions 실행 대기 중..." };
    case "running":
      return { tone: "info", text: "최신 데이터를 생성하고 있습니다... (약 1~2분 소요)" };
    case "applying":
      return {
        tone: "info",
        text: "최신 데이터가 생성되었습니다. Firestore에서 최신 정보를 불러오는 중...",
      };
    case "done":
      if (state.outcome === "updated") {
        return { tone: "success", text: "최신 데이터로 업데이트되었습니다." };
      }
      if (state.outcome === "unchanged") {
        return { tone: "info", text: "이미 최신 데이터입니다." };
      }
      // outcome === "error": workflow succeeded but the snapshot read failed.
      return {
        tone: "error",
        text: "최신 데이터를 생성했지만 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      };
    case "failed":
      return { tone: "error", text: "최신 데이터를 생성하지 못했습니다." };
    case "timeout":
      return { tone: "error", text: "시간 내에 완료되지 않았습니다." };
    case "idle":
    default:
      return null;
  }
}

// How long a TERMINAL success/info message stays before auto-dismissing.
// Error/timeout messages are kept (so the "로그 보기" button stays available)
// until the next 최신화.
const MESSAGE_TIMEOUT_MS = 5000;

function messageToneClass(tone: Tone, isLight: boolean): string {
  if (tone === "success") {
    return isLight ? "text-emerald-600" : "text-emerald-300";
  }
  if (tone === "error") {
    return isLight ? "text-rose-600" : "text-rose-300";
  }
  return isLight ? "text-slate-500" : "text-slate-400";
}

const sortDesc = (a: string, b: string) => (a < b ? 1 : -1);

// -------------------------------------------------------------
// Single reusable dropdown for one segment (year / month / day).
// - Custom (not native <select>) to match the existing dark/light styling.
// - Shows at most ~4 rows then scrolls (requirement 5) so the control height
//   never grows as snapshots accumulate.
// -------------------------------------------------------------
function SegmentDropdown({
  value,
  options,
  onChange,
  isLight,
  ariaLabel,
  suffix,
  minWidthClass,
}: {
  value: string | null;
  options: string[];
  onChange: (next: string) => void;
  isLight: boolean;
  ariaLabel: string;
  suffix?: string;
  minWidthClass: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
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

  const triggerCls = isLight
    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    : "border-[#2a3336] bg-white/[0.04] text-slate-200 hover:bg-white/[0.08]";
  const menuCls = isLight
    ? "border-slate-200 bg-white text-slate-700 shadow-lg"
    : "border-[#2a3336] bg-[#171d1e] text-slate-200 shadow-2xl";
  const optionHoverCls = isLight ? "hover:bg-slate-100" : "hover:bg-white/[0.06]";

  const disabled = options.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`inline-flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${minWidthClass} ${triggerCls}`}
      >
        <span className="num">{value ? `${value}${suffix ?? ""}` : "—"}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.2}
          aria-hidden
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && !disabled ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          // max-h sized for ~4 rows; beyond that the list scrolls vertically.
          className={`absolute left-0 z-30 mt-1 max-h-[8.5rem] w-full min-w-[4.25rem] overflow-auto rounded-lg border py-1 ${menuCls}`}
        >
          {options.map((option) => {
            const active = option === value;
            return (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[12px] font-medium tabular-nums transition-colors ${optionHoverCls} ${
                  active ? "text-blue-500" : ""
                }`}
              >
                <span className="num">{`${option}${suffix ?? ""}`}</span>
                {active ? (
                  <Check size={13} strokeWidth={2.4} aria-hidden className="text-blue-500" />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

// 포트폴리오 관리 상단 "현재 스냅샷" 선택 (년/월/일 3-드롭다운) + 수동 "최신화" 버튼.
// 자동 폴링 없이 사용자가 버튼을 눌렀을 때만 Firestore 최신 스냅샷을 다시 조회한다.
export default function PortfolioSyncControl({
  snapshotDates,
  snapshotDate,
  onSelectSnapshotDate,
  theme = "light",
}: Props) {
  const isLight = theme === "light";
  const { state: pipelineState, isBusy, start, reset } = usePortfolioPipelineRefresh();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build a year -> month -> days tree from the registered snapshot dates only
  // (requirement 10: no hardcoding). Each level is sorted newest-first.
  const tree = useMemo(() => {
    const map = new Map<string, Map<string, Set<string>>>();
    const list = snapshotDate && !(snapshotDates ?? []).includes(snapshotDate)
      ? [snapshotDate, ...(snapshotDates ?? [])]
      : snapshotDates ?? [];
    for (const date of list) {
      const [y, m, d] = (date ?? "").split("-");
      if (!y || !m || !d) continue;
      if (!map.has(y)) map.set(y, new Map());
      const months = map.get(y)!;
      if (!months.has(m)) months.set(m, new Set());
      months.get(m)!.add(d);
    }
    return map;
  }, [snapshotDates, snapshotDate]);

  // Currently selected segments come straight from the controlled date.
  const [selYear, selMonth, selDay] = useMemo(
    () => (snapshotDate ?? "").split("-"),
    [snapshotDate],
  );

  const years = useMemo(() => Array.from(tree.keys()).sort(sortDesc), [tree]);
  const months = useMemo(() => {
    const m = tree.get(selYear ?? "");
    return m ? Array.from(m.keys()).sort(sortDesc) : [];
  }, [tree, selYear]);
  const days = useMemo(() => {
    const dset = tree.get(selYear ?? "")?.get(selMonth ?? "");
    return dset ? Array.from(dset).sort(sortDesc) : [];
  }, [tree, selYear, selMonth]);

  // Newest available month/day within a given year/month (used when an upstream
  // segment changes and we must pick a still-valid downstream value).
  const newestDate = useCallback(
    (year: string, month?: string): string | null => {
      const monthsMap = tree.get(year);
      if (!monthsMap) return null;
      const m = month ?? Array.from(monthsMap.keys()).sort(sortDesc)[0];
      if (!m) return null;
      const dset = monthsMap.get(m);
      if (!dset) return null;
      const d = Array.from(dset).sort(sortDesc)[0];
      if (!d) return null;
      return `${year}-${m}-${d}`;
    },
    [tree],
  );

  const handleYearChange = useCallback(
    (year: string) => {
      const next = newestDate(year);
      if (next) onSelectSnapshotDate?.(next);
    },
    [newestDate, onSelectSnapshotDate],
  );
  const handleMonthChange = useCallback(
    (month: string) => {
      if (!selYear) return;
      const next = newestDate(selYear, month);
      if (next) onSelectSnapshotDate?.(next);
    },
    [newestDate, onSelectSnapshotDate, selYear],
  );
  const handleDayChange = useCallback(
    (day: string) => {
      if (!selYear || !selMonth) return;
      onSelectSnapshotDate?.(`${selYear}-${selMonth}-${day}`);
    },
    [onSelectSnapshotDate, selYear, selMonth],
  );

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  // The message is derived directly from the pipeline phase.
  const message = useMemo(() => pipelineMessage(pipelineState), [pipelineState]);

  // Auto-dismiss only success/info terminal messages. Error/timeout messages
  // are kept so the "GitHub Actions 로그 보기" button remains available until the
  // user starts another 최신화.
  useEffect(() => {
    clearTimer();
    if (pipelineState.phase === "done" && pipelineState.outcome !== "error") {
      timerRef.current = setTimeout(() => {
        reset();
        timerRef.current = null;
      }, MESSAGE_TIMEOUT_MS);
    }
    return clearTimer;
  }, [pipelineState, clearTimer, reset]);

  const handleClick = useCallback(() => {
    if (isBusy) return; // double-click guard (UI side; hook guards too)
    clearTimer();
    void start();
  }, [isBusy, start, clearTimer]);

  const labelCls = isLight ? "text-slate-400" : "text-slate-500";

  const buttonCls = isLight
    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
    : "border-[#2a3336] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white";

  const hasSnapshots = years.length > 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* 현재 스냅샷 — 년/월/일 3개 드롭다운으로 분리 (요구사항 6). */}
      <div className="inline-flex items-center gap-2 text-[12px]">
        <span className={labelCls}>현재 스냅샷</span>
        {hasSnapshots ? (
          <div className="inline-flex items-center gap-1.5">
            <SegmentDropdown
              value={selYear ?? null}
              options={years}
              onChange={handleYearChange}
              isLight={isLight}
              ariaLabel="년도 선택"
              minWidthClass="min-w-[4.25rem]"
            />
            <SegmentDropdown
              value={selMonth ?? null}
              options={months}
              onChange={handleMonthChange}
              isLight={isLight}
              ariaLabel="월 선택"
              minWidthClass="min-w-[3.25rem]"
            />
            <SegmentDropdown
              value={selDay ?? null}
              options={days}
              onChange={handleDayChange}
              isLight={isLight}
              ariaLabel="일 선택"
              minWidthClass="min-w-[3.25rem]"
            />
          </div>
        ) : (
          <span className={`font-semibold tabular-nums ${isLight ? "text-slate-500" : "text-slate-400"}`}>
            —
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        aria-busy={isBusy}
        aria-label="최신 데이터로 최신화 (전체 파이프라인 실행)"
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonCls}`}
      >
        {isBusy ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden />
            최신 데이터 생성 중...
          </>
        ) : (
          <>
            <RefreshCw size={14} strokeWidth={2.2} aria-hidden />
            최신화
          </>
        )}
      </button>

      {message ? (
        <span className="inline-flex items-center gap-2">
          <span
            role="status"
            aria-live="polite"
            className={`text-[12px] font-medium ${messageToneClass(message.tone, isLight)}`}
          >
            {message.text}
          </span>
          {/* On failure/timeout, let the user jump straight to the run log
              (requirement 7) — opens the GitHub Actions run in a new tab. */}
          {(pipelineState.phase === "failed" || pipelineState.phase === "timeout") &&
          pipelineState.runUrl ? (
            <a
              href={pipelineState.runUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                isLight
                  ? "border-rose-200 text-rose-600 hover:bg-rose-50"
                  : "border-rose-500/30 text-rose-300 hover:bg-rose-500/10"
              }`}
            >
              <ExternalLink size={12} strokeWidth={2.2} aria-hidden />
              GitHub Actions 로그 보기
            </a>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
