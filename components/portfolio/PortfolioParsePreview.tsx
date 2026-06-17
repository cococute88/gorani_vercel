"use client";

import TableCsvMenu from "@/components/ui/TableCsvMenu";
import { AlertTriangle, XCircle } from "lucide-react";
import { parseSummaryFromResult } from "@/lib/portfolio-parse-summary";
import ParseSummaryCard from "./ParseSummaryCard";
import type { ParseResult } from "@/lib/banksalad-parser";

interface Props {
  result: ParseResult | null;
}

function RawTable({ header, rows, filename }: { header: string[]; rows: string[][]; filename: string }) {
  if (header.length === 0 && rows.length === 0) return null;
  const columns = header.map((h, i) => ({ header: h || "—", value: (row: string[]) => row[i] ?? "" }));
  return (
    <div className="relative mt-2">
      <div className="absolute right-1 top-1 z-20"><TableCsvMenu filename={filename} rows={rows} columns={columns} /></div>
      <div className="scroll-dark max-h-[240px] overflow-auto rounded-lg border border-[#1c2426]">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 bg-[#11181a]">
          <tr className="text-left text-slate-400">
            {header.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-2.5 py-1.5 font-medium">{h || "—"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-t border-[#1c2426]">
              {r.map((c, ci) => (
                <td key={ci} className="whitespace-nowrap px-2.5 py-1.5 text-slate-300">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

// 파싱 결과 요약(3x3) + 원본 preview 테이블 + 경고/오류.
// 3x3 요약 카드는 ParseSummaryCard 로 분리해 스냅샷 상세에서도 재사용한다.
export default function PortfolioParsePreview({ result }: Props) {
  if (!result) {
    return <ParseSummaryCard model={null} />;
  }

  return (
    <ParseSummaryCard model={parseSummaryFromResult(result)}>
      {(result.warnings.length > 0 || result.errors.length > 0) && (
        <div className="mt-4 flex flex-col gap-1.5">
          {result.errors.map((e, i) => (
            <div key={`er-${i}`} className="flex items-center gap-2 rounded-md bg-red-500/10 px-3 py-1.5 text-[12.5px] text-red-300">
              <XCircle size={13} /> {e}
            </div>
          ))}
          {result.warnings.map((w, i) => (
            <div key={`wn-${i}`} className="flex items-center gap-2 rounded-md bg-amber-500/10 px-3 py-1.5 text-[12.5px] text-amber-300">
              <AlertTriangle size={13} /> {w}
            </div>
          ))}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-medium text-slate-300">원본 데이터 미리보기 (3.재무현황 / 5.투자현황)</summary>
        <div className="mt-1 text-[12px] text-slate-400">3. 재무현황</div>
        <RawTable header={result.preview.financeHeader} rows={result.preview.financeRows} filename="portfolio-parse-finance-preview.csv" />
        <div className="mt-3 text-[12px] text-slate-400">5. 투자현황</div>
        <RawTable header={result.preview.investmentHeader} rows={result.preview.investmentRows} filename="portfolio-parse-investment-preview.csv" />
      </details>
    </ParseSummaryCard>
  );
}
