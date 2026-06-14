"use client";

import { useEffect, useState } from "react";

interface Props {
  ticker: string | null;
  initialMemo: string;
  onSave: (ticker: string, memo: string) => void;
  onClose: () => void;
}

// Per-ticker shared memo dialog (mirrors Streamlit `show_memo_dialog`). Opened
// from the lower ticker grid; pre-fills the legacy/imported memo and lets the
// user view/edit it. Saving persists under the canonical ticker key.
export default function TickerMemoDialog({ ticker, initialMemo, onSave, onClose }: Props) {
  const [memo, setMemo] = useState(initialMemo);

  useEffect(() => {
    setMemo(initialMemo);
  }, [ticker, initialMemo]);

  if (!ticker) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-[#344044] bg-[#151b1d] p-4 shadow-2xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-300">종목 메모</p>
            <h2 className="mt-0.5 text-[20px] font-extrabold text-white sm:text-[24px]">{ticker}</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">메모는 해당 종목의 모든 일정에 공유됩니다.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15">✕</button>
        </div>

        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={`${ticker}에 대한 메모를 입력하세요 (한 줄 권장).`}
          className="h-32 w-full resize-none rounded-xl border border-[#303b3f] bg-[#0f1415] p-3 text-[13px] text-slate-800 outline-none placeholder:text-slate-500 focus:border-blue-500/50 dark:text-slate-200"
        />

        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg bg-black/5 px-4 py-2 text-[12px] font-semibold text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15 sm:text-[13px]">
            닫기
          </button>
          <button type="button" onClick={() => onSave(ticker, memo)} className="rounded-lg bg-blue-600 px-4 py-2 text-[12px] font-semibold text-white hover:bg-blue-500 sm:text-[13px]">
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
