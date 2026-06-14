"use client";

import { hasTickerMemo } from "@/lib/calendar-memo-matching";

interface Props {
  tickers: string[];
  memos: Record<string, string>;
  onTickerClick: (ticker: string) => void;
  fromPortfolio: boolean;
}

// Lower "티커 관리" area. Ticker add/remove now lives in the "기본 포트폴리오 관리"
// modal; here each ticker is a button that opens its shared memo (matches the
// original Streamlit desktop ticker-button grid that opens `show_memo_dialog`).
export default function TickerManager({ tickers, memos, onTickerClick, fromPortfolio }: Props) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-slate-600 dark:text-slate-400">
          👆 <span className="font-bold text-slate-800 dark:text-slate-200">티커 버튼</span>을 클릭하면 종목 메모를 조회하고 수정할 수 있습니다.
        </p>
        {fromPortfolio && (
          <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11.5px] text-emerald-600 dark:text-emerald-400">
            포트폴리오 보유종목 연동됨
          </span>
        )}
      </div>

      {tickers.length === 0 ? (
        <p className="text-[13px] text-slate-500">등록된 티커가 없습니다. 상단 “관리”에서 추가하세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10">
          {tickers.map((ticker) => {
            const memoExists = hasTickerMemo(memos, ticker);
            return (
              <button
                key={ticker}
                type="button"
                onClick={() => onTickerClick(ticker)}
                title={memoExists ? "메모 있음 · 클릭하여 조회/수정" : "메모 없음 · 클릭하여 추가"}
                className="relative flex items-center justify-center gap-1 rounded-lg border border-[#2a3336] bg-[#11181a] px-2 py-2 text-[13px] font-semibold text-slate-800 transition hover:border-blue-400/60 hover:bg-blue-500/10 dark:text-slate-100"
              >
                {ticker}
                {memoExists && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
