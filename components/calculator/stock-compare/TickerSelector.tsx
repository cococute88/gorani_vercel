"use client";

import { ArrowLeftRight, Search } from "lucide-react";
import { COMPARE_TICKER_OPTIONS, normalizeCompareTicker } from "@/lib/stock-compare/constants";

// =============================================================
// 두 티커 입력 + datalist 자동완성. 비교 실행/스왑 컨트롤 포함.
// 잘못된 티커(빈값/동일값)는 상위에서 안내하고, 여기서는 정규화만 한다.
// =============================================================

interface Props {
  valueA: string;
  valueB: string;
  onChangeA: (value: string) => void;
  onChangeB: (value: string) => void;
  onSwap: () => void;
  onSubmit: () => void;
  loading: boolean;
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] font-semibold uppercase text-slate-900 outline-none transition-colors placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:border-blue-500 dark:border-[#2a3336] dark:bg-[#11171a] dark:text-white";

function TickerField({
  id,
  label,
  value,
  onChange,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <label className="block min-w-0 flex-1">
      <span className="mb-1.5 block text-[12px] font-semibold text-slate-500 dark:text-slate-400">{label}</span>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          list={`${id}-list`}
          value={value}
          placeholder="예: SPY"
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter();
          }}
          className={`${fieldClass} pl-9`}
        />
        <datalist id={`${id}-list`}>
          {COMPARE_TICKER_OPTIONS.map((o) => (
            <option key={o.ticker} value={o.ticker}>
              {o.name}
            </option>
          ))}
        </datalist>
      </div>
    </label>
  );
}

export default function TickerSelector({
  valueA,
  valueB,
  onChangeA,
  onChangeB,
  onSwap,
  onSubmit,
  loading,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <TickerField id="cmp-a" label="티커 A" value={valueA} onChange={onChangeA} onEnter={onSubmit} />
      <button
        type="button"
        onClick={onSwap}
        aria-label="티커 교체"
        title="티커 교체"
        className="mx-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 dark:border-[#2a3336] dark:text-slate-400 dark:hover:bg-white/5 sm:mb-0.5"
      >
        <ArrowLeftRight className="h-4 w-4" />
      </button>
      <TickerField id="cmp-b" label="티커 B" value={valueB} onChange={onChangeB} onEnter={onSubmit} />
      <button
        type="button"
        onClick={onSubmit}
        disabled={loading || !normalizeCompareTicker(valueA) || !normalizeCompareTicker(valueB)}
        className="h-[42px] shrink-0 rounded-xl bg-blue-600 px-5 text-[14px] font-bold text-white shadow-lg shadow-blue-950/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 sm:mb-0.5"
      >
        {loading ? "분석 중…" : "비교"}
      </button>
    </div>
  );
}
