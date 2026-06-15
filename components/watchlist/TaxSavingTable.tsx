"use client";

import { useMemo, useState } from "react";
import type { TaxSavingRow } from "@/lib/mock-calendar-data";

interface Props {
  rows: TaxSavingRow[];
}

type TaxSortDirection = "asc" | "desc";

function formatTaxSaving(row: TaxSavingRow): string {
  if (row.isLoading) return "...";
  if (!row.canCalculate) return "—";
  return `$${row.taxSavingUsd.toFixed(2)}`;
}

function getSortableTaxSaving(row: TaxSavingRow): number | null {
  return row.canCalculate && Number.isFinite(row.taxSavingUsd) ? row.taxSavingUsd : null;
}

function compareTaxSavingRows(a: TaxSavingRow, b: TaxSavingRow, direction: TaxSortDirection): number {
  const av = getSortableTaxSaving(a);
  const bv = getSortableTaxSaving(b);
  const aMissing = av == null;
  const bMissing = bv == null;
  if (aMissing && bMissing) return a.ticker.localeCompare(b.ticker);
  if (aMissing) return 1;
  if (bMissing) return -1;
  const delta = direction === "desc" ? bv - av : av - bv;
  return delta || a.ticker.localeCompare(b.ticker);
}

export default function TaxSavingTable({ rows }: Props) {
  const [taxSortDirection, setTaxSortDirection] = useState<TaxSortDirection>("desc");
  const buyCount = rows.filter((row) => row.shouldBuyThisMonth).length;
  const sortedRows = useMemo(
    () => rows.map((row, index) => ({ row, index })).sort((a, b) => compareTaxSavingRows(a.row, b.row, taxSortDirection) || a.index - b.index).map(({ row }) => row),
    [rows, taxSortDirection],
  );

  return (
    // flex-col + capped scroll body keeps the rail from running far past the calendar.
    <section className="flex flex-col overflow-hidden rounded-2xl border border-[#2a3336] bg-[#191f20]">
      <div className="shrink-0 p-3 pb-2 sm:p-4 sm:pb-2">
        <h2 className="text-[14px] font-bold text-slate-200 sm:text-[15px]">종목별 예상 절세액</h2>
        <p className="text-[11px] text-slate-400 sm:text-[12px]">투자금 $10,000 기준 1회 절세 예상</p>
        {buyCount > 0 && (
          <p className="mt-1 text-[10.5px] text-blue-300/90 sm:text-[11px]">파란 음영 = 이번 달 매수 대상 {buyCount}종목</p>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto px-3 pb-3 sm:px-4 sm:pb-4 xl:max-h-[600px]">
        <table className="w-full table-fixed text-[11.5px] sm:text-[12.5px]">
          <colgroup>
            <col className="w-[52%]" />
            <col className="w-[48%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-[#191f20]">
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="py-1.5 pr-2 font-medium sm:py-2">종목</th>
              <th className="py-1.5 pl-2 text-right font-medium sm:py-2">
                <button
                  type="button"
                  onClick={() => setTaxSortDirection((current) => (current === "desc" ? "asc" : "desc"))}
                  className="inline-flex items-center justify-end gap-1 whitespace-nowrap rounded px-1 py-0.5 text-right transition hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/50"
                  aria-label={`절세액 ${taxSortDirection === "desc" ? "내림차순" : "오름차순"} 정렬`}
                >
                  <span>절세액</span>
                  <span aria-hidden>{taxSortDirection === "desc" ? "↓" : "↑"}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={2} className="py-6 text-center text-[12px] text-slate-500">
                  표시할 종목이 없습니다.
                </td>
              </tr>
            )}
            {sortedRows.map((row) => {
              const warningText = row.warnings.join(" | ");
              const highlight = row.shouldBuyThisMonth;
              return (
                <tr
                  key={row.ticker}
                  title={warningText || undefined}
                  className={`border-b border-[#20282a] last:border-0 ${highlight ? "bg-blue-500/10" : ""}`}
                >
                  <td className="truncate py-2 pr-2 font-bold text-white sm:py-2.5">
                    {highlight && <span className="mr-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 align-middle" />}
                    {row.ticker}
                  </td>
                  <td
                    className={`num py-2 pl-2 text-right sm:py-2.5 ${row.canCalculate ? "text-slate-200" : row.isLoading ? "text-slate-400" : "text-amber-200"}`}
                  >
                    {formatTaxSaving(row)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
