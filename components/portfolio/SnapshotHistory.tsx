"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import { formatWon, formatPercent } from "@/lib/format";
import type { PortfolioSnapshot } from "@/lib/portfolio-types";

interface Props {
  snapshots: PortfolioSnapshot[];
  onDelete: (id: string) => void;
  onSelect?: (snapshot: PortfolioSnapshot) => void;
  selectedSnapshotId?: string | null;
  loading?: boolean;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 기본 표시 개수. 향후 페이지네이션으로 바꾸기 쉽도록 상수로 관리한다(요구사항 17).
// "더보기"를 누르면 이 단위만큼 표시 개수가 늘어난다(요구사항 14).
export const SNAPSHOT_HISTORY_PAGE_SIZE = 10;

// 등록된 스냅샷 히스토리 (날짜/총자산/평가금액/원금/수익률/삭제)
// - 최신 날짜가 항상 가장 위 (요구사항 13)
// - 기본 최근 10개만 표시, "더보기"로 10개씩 점진적 확장 (요구사항 13~15)
// - 선택된 스냅샷이 표시 범위 밖이면 자동으로 펼쳐 항상 보이게 한다 (요구사항 16)
export default function SnapshotHistory({ snapshots, onDelete, onSelect, selectedSnapshotId, loading = false }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sorted = useMemo(
    () => [...snapshots].sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1)),
    [snapshots],
  );

  const [visibleCount, setVisibleCount] = useState(SNAPSHOT_HISTORY_PAGE_SIZE);

  // 선택된 스냅샷이 현재 표시 범위 밖이면, 해당 위치까지 자동으로 펼친다(요구사항 16).
  useEffect(() => {
    if (!selectedSnapshotId) return;
    const index = sorted.findIndex((s) => s.id === selectedSnapshotId);
    if (index < 0) return;
    setVisibleCount((prev) => {
      if (index < prev) return prev;
      // index 를 포함하도록 PAGE_SIZE 단위로 올림.
      const needed = Math.ceil((index + 1) / SNAPSHOT_HISTORY_PAGE_SIZE) * SNAPSHOT_HISTORY_PAGE_SIZE;
      return Math.max(prev, needed);
    });
  }, [selectedSnapshotId, sorted]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const remaining = sorted.length - visibleCount;

  return (
    <div className={card}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold text-slate-300">등록된 스냅샷 히스토리</h2>
        <TableCsvMenu filename={`portfolio-snapshot-history-${today}.csv`} rows={sorted} columns={[
          { header: "날짜", value: (row) => row.snapshotDate },
          { header: "총자산", value: (row) => formatWon(row.totalAssetKRW) },
          { header: "투자 평가금액", value: (row) => formatWon(row.investmentValueKRW) },
          { header: "투자원금", value: (row) => formatWon(row.investmentPrincipalKRW) },
          { header: "수익률", value: (row) => formatPercent(row.returnPct, 1) },
        ]} />
      </div>
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
            {sorted.length === 0 && loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-400">로그인/클라우드 스냅샷을 확인 중입니다.</td>
              </tr>
            )}
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">등록된 스냅샷이 없습니다.</td>
              </tr>
            )}
            {visible.map((s) => {
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

      {/* 더보기 — 무한스크롤 없이 PAGE_SIZE 단위로 점진적 확장 (요구사항 14~15). */}
      {hasMore && (
        <div className="mt-3 flex items-center justify-center">
          <button
            type="button"
            onClick={() =>
              setVisibleCount((prev) =>
                Math.min(prev + SNAPSHOT_HISTORY_PAGE_SIZE, sorted.length),
              )
            }
            className="rounded-lg border border-[#2a3336] bg-white/[0.04] px-4 py-1.5 text-[12px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
          >
            더보기 ({Math.min(SNAPSHOT_HISTORY_PAGE_SIZE, remaining)}개 더 · 남은 {remaining}개)
          </button>
        </div>
      )}
    </div>
  );
}
