"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  tickers: string[];
  onAdd: (raw: string) => void;
  onRemove: (ticker: string) => void;
  onClose: () => void;
}

// "기본 포트폴리오 관리" modal. Owns add/remove of calendar tickers using the
// same portfolio source as the page (localStorage + Firestore calendarTickers).
export default function PortfolioManageModal({ open, tickers, onAdd, onRemove, onClose }: Props) {
  const [input, setInput] = useState("");

  if (!open) return null;

  const handleAdd = () => {
    if (input.trim()) {
      onAdd(input);
      setInput("");
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 sm:p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-[#344044] bg-[#151b1d] p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-extrabold text-white sm:text-[19px]">기본 포트폴리오 관리</h2>
            <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">캘린더에 표시할 티커를 추가/삭제합니다.</p>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-full bg-black/5 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-black/10 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/15">✕</button>
        </div>

        {/* Add input */}
        <div className="flex items-stretch gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="티커 추가 (예: SCHD, QQQ TQQQ)"
            className="min-w-0 flex-1 rounded-lg border border-[#2a3336] bg-[#11181a] px-3 py-2 text-[14px] text-white outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-[18px] font-bold text-white hover:bg-blue-500"
            aria-label="티커 추가"
          >
            +
          </button>
        </div>

        {/* Ticker chips */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-[#2a3336] bg-[#11181a] p-3">
          <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">등록된 티커 {tickers.length}개</p>
          <div className="flex flex-wrap gap-2">
            {tickers.length === 0 && <span className="text-[13px] text-slate-500">등록된 티커가 없습니다.</span>}
            {tickers.map((ticker) => (
              <span
                key={ticker}
                className="flex items-center gap-1.5 rounded-full border border-[#2a3336] bg-[#191f20] px-3 py-1 text-[13px] font-medium text-white"
              >
                {ticker}
                <button type="button" onClick={() => onRemove(ticker)} className="text-slate-500 hover:text-red-400" aria-label={`${ticker} 삭제`}>
                  <X size={13} />
                </button>
              </span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-500"
          >
            저장 / 닫기
          </button>
        </div>
      </div>
    </div>
  );
}
