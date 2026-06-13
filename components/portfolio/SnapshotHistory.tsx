"use client";

import { Trash2 } from "lucide-react";
import { formatWon, formatPercent } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";

interface Props {
  snapshots: PortfolioSnapshot[];
  onDelete: (id: string) => void;
  onSelect?: (snapshot: PortfolioSnapshot) => void;
  selectedSnapshotId?: string | null;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 등록된 스냅샷 히스토리 (날짜/총자산/평가금액/원금/수익률/삭제)
export default function SnapshotHistory({ snapshots, onDelete, onSelect, selectedSnapshotId }: Props) {
  const sorted = [...snapshots].sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));
  return (
    <div className={card}>
      <h2 className="mb-4 text-[15px] font-bold text-slate-300">등록된 스냅샷 히스토리</h2>
      <div className="scroll-dark overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="px-3 py-2 font-medium">날짜</th>
              <th className="px-3 py-2 text-right font-medium">총자산</th>
              <th className="px-3 py-2 text-right font-medium">투자 평가금액</th>
              <th className="px-3 py-2 text-right font-medium">투자원금</th>
              <th className="px-3 py-2 text-right font-medium">수익률</th>
              <th className="px-3 py-2 text-right font-medium">관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">등록된 스냅샷이 없습니다.</td>
              </tr>
            )}
            {sorted.map((s) => {
              const selected = selectedSnapshotId === s.id;
              return (
                <tr
                  key={s.id}
                  onClick={() => onSelect?.(s)}
                  className={`cursor-pointer border-b border-[#1c2426] transition-colors ${
                    selected ? "bg-blue-500/10 hover:bg-blue-500/15" : "hover:bg-white/[0.02]"
                  }`}
                  title="스냅샷 미리보기"
                >
                  <td className="num px-3 py-2.5 font-semibold text-white">{s.snapshotDate}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(s.totalAssetKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(s.investmentValueKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatWon(s.investmentPrincipalKRW)}</td>
                  <td className={`num px-3 py-2.5 text-right ${s.returnPct >= 0 ? "text-red-400" : "text-blue-400"}`}>
                    {formatPercent(s.returnPct, 1)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onDelete(s.id);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-red-400"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
