"use client";

import type { CsvColumn } from "@/lib/csv-download";
import { buildCsv, downloadCsv } from "@/lib/csv-download";

type Props<T> = {
  filename: string;
  rows: T[];
  columns: CsvColumn<T>[];
  disabled?: boolean;
  className?: string;
};

export default function TableCsvMenu<T>({ filename, rows, columns, disabled = false, className = "" }: Props<T>) {
  const isDisabled = disabled || rows.length === 0 || columns.length === 0;
  return (
    <button
      type="button"
      disabled={isDisabled}
      title={isDisabled ? "다운로드할 데이터 없음" : "CSV 다운로드"}
      aria-label={isDisabled ? "다운로드할 데이터 없음" : "Download as CSV / CSV 다운로드"}
      onClick={() => downloadCsv(filename, buildCsv(rows, columns))}
      className={`inline-flex h-7 shrink-0 items-center rounded-md border border-slate-500/30 bg-white/5 px-2 text-[11px] font-semibold text-slate-400 shadow-sm transition hover:border-blue-400/50 hover:bg-blue-500/10 hover:text-blue-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      CSV
    </button>
  );
}
