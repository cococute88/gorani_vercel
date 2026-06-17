"use client";

import { useMemo } from "react";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import { formatWon } from "@/lib/format";
import type { FinanceAsset } from "@/lib/portfolio-types";

interface Props {
  assets: FinanceAsset[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function categoryTone(cat?: string): string {
  switch (cat) {
    case "현금":
      return "bg-sky-500/10 text-sky-300";
    case "예적금":
      return "bg-emerald-500/10 text-emerald-300";
    case "투자성":
      return "bg-purple-500/10 text-purple-300";
    default:
      return "bg-white/5 text-slate-300";
  }
}

// 자산 리스트 (항목/상품명/금액/태그/분류)
export default function AssetTable({ assets }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-300">자산 리스트</h2>
        <TableCsvMenu filename={`portfolio-assets-${today}.csv`} rows={assets} columns={[
          { header: "항목(그룹)", value: (row) => row.groupName || "—" },
          { header: "상품명", value: (row) => row.cleanName ?? row.productName },
          { header: "금액", value: (row) => formatWon(row.amountKRW) },
          { header: "태그", value: (row) => row.inferredTag ? `#${row.inferredTag}` : "" },
          { header: "분류", value: (row) => row.category ?? "기타" },
          { header: "심볼그룹", value: (row) => row.symbolGroup ?? "" },
          { header: "계좌그룹", value: (row) => row.accountGroup ?? "" },
          { header: "목적그룹", value: (row) => row.purposeGroup ?? "" },
          { header: "상태그룹", value: (row) => row.statusGroup ?? "" },
        ]} />
      </div>
      <div className="scroll-dark overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="px-3 py-2 font-medium">항목(그룹)</th>
              <th className="px-3 py-2 font-medium">상품명 / 태그</th>
              <th className="px-3 py-2 text-right font-medium">금액</th>
              <th className="px-3 py-2 font-medium">태그</th>
              <th className="px-3 py-2 font-medium">분류</th>
            </tr>
          </thead>
          <tbody>
            {assets.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-slate-500">자산 항목이 없습니다.</td>
              </tr>
            )}
            {assets.map((a) => (
              <tr key={a.id} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                <td className="px-3 py-2.5 text-slate-300">{a.groupName || "—"}</td>
                <td className="px-3 py-2.5 text-slate-200">
                  <div>
                    {a.cleanName ?? a.productName}
                    {a.isDebt && <span className="ml-1.5 text-[11px] text-red-400">(부채)</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {a.symbolGroup && <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10.5px] text-blue-300">① {a.symbolGroup}</span>}
                    {a.accountGroup && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] text-emerald-300">② {a.accountGroup}</span>}
                    {a.purposeGroup && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] text-amber-300">③ {a.purposeGroup}</span>}
                    {a.statusGroup && <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10.5px] text-purple-300">④ {a.statusGroup}</span>}
                  </div>
                </td>
                <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(a.amountKRW)}</td>
                <td className="px-3 py-2.5">
                  {a.inferredTag ? (
                    <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11.5px] text-slate-300">#{a.inferredTag}</span>
                  ) : (
                    <span className="text-slate-600">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-md px-2 py-0.5 text-[11.5px] ${categoryTone(a.category)}`}>
                    {a.category ?? "기타"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
