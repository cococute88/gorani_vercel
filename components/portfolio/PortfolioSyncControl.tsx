"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import {
  usePortfolioRefresh,
  type PortfolioRefreshOutcome,
} from "@/lib/portfolio-firestore-snapshot-sync";

type Props = {
  /** Active snapshot date currently driving the Portfolio screen (YYYY-MM-DD). */
  snapshotDate: string | null;
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

// 포트폴리오 상단 "최근 동기화" 표시 + 수동 "최신화" 버튼.
// 자동 폴링 없이 사용자가 버튼을 눌렀을 때만 Firestore 최신 스냅샷을 다시 조회한다.
export default function PortfolioSyncControl({ snapshotDate, theme = "light" }: Props) {
  const isLight = theme === "light";
  const { isRefreshing, refresh } = usePortfolioRefresh();
  const [message, setMessage] = useState<ResultMessage | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

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
  const dateCls = isLight ? "text-slate-600" : "text-slate-300";

  const buttonCls = isLight
    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800"
    : "border-[#2a3336] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] hover:text-white";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="inline-flex items-center gap-1.5 text-[12px]">
        <span className={labelCls}>최근 동기화</span>
        <span className={`num font-semibold tabular-nums ${dateCls}`}>
          {snapshotDate ?? "—"}
        </span>
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
