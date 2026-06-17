"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import {
  filterQldRankings,
  PERFORMANCE_ACCOUNT_TYPES,
  type PerformanceAccountType,
  type PerformanceQldRankingRow,
  type PerformanceQldResult,
} from "@/lib/performance-qld-from-snapshots";

const won = (v: number | null) => (v === null ? "—" : `${Math.round(v).toLocaleString("ko-KR")}원`);
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const toneCls = (v: number | null) =>
  v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-400" : "text-rose-400";

// 정렬 가능한 숫자 컬럼.
type SortKey = "weightPct" | "valueKRW" | "principalKRW" | "profitKRW" | "returnPct";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Array<{ key: SortKey; label: string }> = [
  { key: "weightPct", label: "비중" },
  { key: "valueKRW", label: "평가금액" },
  { key: "principalKRW", label: "투자원금" },
  { key: "profitKRW", label: "누적 손익" },
  { key: "returnPct", label: "누적 수익률" },
];

function isValidNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// 실제 numeric sort. null/undefined/NaN 은 정렬 방향과 무관하게 항상 맨 아래로 보낸다.
function sortRows(
  rows: PerformanceQldRankingRow[],
  key: SortKey,
  dir: SortDir,
): PerformanceQldRankingRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    const aValid = isValidNumber(av);
    const bValid = isValidNumber(bv);
    if (!aValid && !bValid) return 0;
    if (!aValid) return 1;
    if (!bValid) return -1;
    if (av === bv) return 0;
    return (av - bv) * factor;
  });
}

// 종목 랭킹 테이블 — 위탁/연금/ISA 계좌 필터 + 컬럼 헤더 클릭 정렬 (#PERFORMANCE-DONUT-RANKING-1)
export default function QldHoldingsRankTable({ data }: { data: PerformanceQldResult }) {
  // 필터 기본값: 세 계좌 유형 모두 선택.
  const [enabled, setEnabled] = useState<Record<PerformanceAccountType, boolean>>({
    위탁: true,
    연금: true,
    ISA: true,
  });
  // 정렬 기본값: 평가금액 내림차순 (기존 동작 유지).
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: "valueKRW", dir: "desc" });

  const enabledTypes = PERFORMANCE_ACCOUNT_TYPES.filter((type) => enabled[type]);
  // 적용 순서: 1) 계좌 필터 → 2) 정렬 → 3) 렌더링.
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const filtered = filterQldRankings(data.rankings, enabledTypes);
    return sortRows(filtered, sort.key, sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.rankings, enabled.위탁, enabled.연금, enabled.ISA, sort.key, sort.dir]);

  const toggle = (type: PerformanceAccountType) =>
    setEnabled((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      // 모든 필터를 끄면 빈 화면이 되므로 최소 1개는 유지한다.
      if (!next.위탁 && !next.연금 && !next.ISA) return prev;
      return next;
    });

  // 헤더 클릭: 같은 컬럼이면 방향 토글, 다른 컬럼이면 내림차순부터 시작.
  const onSort = (key: SortKey) =>
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "desc" ? "asc" : "desc" } : { key, dir: "desc" }));

  const sortIndicator = (key: SortKey) => {
    if (sort.key !== key) return null;
    const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
    return <Icon size={11} strokeWidth={2.5} className="inline-block align-middle" />;
  };

  const hasProfit = rows.some((row) => row.profitKRW !== null);
  const activeColumnLabel = SORT_COLUMNS.find((col) => col.key === sort.key)?.label ?? "평가금액";

  return (
    <div className="rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[15px] font-bold text-slate-100">종목 랭킹</span>
          {!hasProfit && rows.length > 0 && (
            <p className="mt-1 text-[11.5px] text-amber-300">
              원금 정보가 부족한 종목은 손익과 수익률을 표시하지 않습니다.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
            전체 {rows.length}개
          </span>
          <TableCsvMenu filename={`performance-ranking-${today}.csv`} rows={rows} columns={[
            { header: "종목", value: (row) => row.ticker },
            { header: "종목명", value: (row) => row.name },
            { header: "비중", value: (row) => row.weightPct === null ? "—" : `${row.weightPct.toFixed(2)}%` },
            { header: "평가금액", value: (row) => won(row.valueKRW) },
            { header: "투자원금", value: (row) => won(row.principalKRW) },
            { header: "누적 손익", value: (row) => won(row.profitKRW) },
            { header: "누적 수익률", value: (row) => pct(row.returnPct) },
          ]} />
          <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
            {activeColumnLabel} {sort.dir === "asc" ? "오름차순" : "내림차순"}
          </span>
        </div>
      </div>

      {/* 계좌 유형 필터 (위탁/연금/ISA, 기본 전체 선택) */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-slate-500">계좌 필터</span>
        {PERFORMANCE_ACCOUNT_TYPES.map((type) => {
          const active = enabled[type];
          return (
            <button
              key={type}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(type)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                active
                  ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                  : "border-[#2a3142] bg-[#0e111a] text-slate-500 hover:text-slate-300"
              }`}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border text-[9px] ${
                  active ? "border-blue-400 bg-blue-500 text-white" : "border-slate-600 text-transparent"
                }`}
              >
                ✓
              </span>
              {type}
            </button>
          );
        })}
      </div>

      {/* 모바일 정렬 컨트롤 (테이블 헤더가 숨겨지는 화면용) */}
      {rows.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 lg:hidden">
          <span className="mr-1 text-[11px] font-medium text-slate-500">정렬</span>
          {SORT_COLUMNS.map((col) => {
            const active = sort.key === col.key;
            return (
              <button
                key={col.key}
                type="button"
                aria-pressed={active}
                onClick={() => onSort(col.key)}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors ${
                  active
                    ? "border-blue-500/60 bg-blue-500/15 text-blue-200"
                    : "border-[#2a3142] bg-[#0e111a] text-slate-500 hover:text-slate-300"
                }`}
              >
                {col.label}
                {active && sortIndicator(col.key)}
              </button>
            );
          })}
        </div>
      )}

      {rows.length === 0 && (
        <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-4 py-8 text-center text-[13px] text-slate-500">
          {data.flags.hasHoldings
            ? "선택한 계좌 유형에 표시할 보유종목이 없습니다."
            : "최신 스냅샷에 보유종목이 없어 랭킹을 표시할 수 없습니다."}
        </div>
      )}

      {/* 모바일: 랭킹 카드 (가로 스크롤 없이 핵심 지표 표시) — 내부 세로 스크롤 */}
      {rows.length > 0 && (
        <div className="max-h-[460px] space-y-2.5 overflow-y-auto pr-0.5 lg:hidden">
          {rows.map((r, i) => (
            <div key={r.ticker} className="rounded-2xl border border-[#222838] bg-[#0e111a] p-3">
              <div className="flex items-center gap-2.5">
                <span className="w-4 shrink-0 text-[11px] text-slate-600">{i + 1}</span>
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white/90"
                  style={{ backgroundColor: r.color }}
                >
                  {r.ticker.slice(0, 2)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold text-slate-100">{r.ticker}</div>
                  <div className="truncate text-[11px] text-slate-500">{r.name}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-[11px] text-slate-400">
                    비중 {r.weightPct === null ? "—" : `${r.weightPct.toFixed(2)}%`}
                  </div>
                  <div className="num text-[13px] font-semibold text-slate-100">{won(r.valueKRW)}</div>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[#191e2b] pt-2.5">
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">투자원금</div>
                  <div className="num truncate text-[12px] text-slate-300">{won(r.principalKRW)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">누적 손익</div>
                  <div className={`num truncate text-[12px] font-medium ${toneCls(r.profitKRW)}`}>{won(r.profitKRW)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">누적 수익률</div>
                  <div className={`num truncate text-[12px] font-semibold ${toneCls(r.returnPct)}`}>{pct(r.returnPct)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* lg+ : 데스크톱 표 — 헤더 고정 + 클릭 정렬 + 내부 세로 스크롤 */}
      {rows.length > 0 && (
        <div className="hidden max-h-[460px] overflow-auto lg:block">
          <table className="w-full min-w-[720px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#12151e]">
              <tr className="border-b border-[#222838] text-[11.5px] text-slate-500">
                <th className="bg-[#12151e] py-2 pl-1 text-left font-medium">종목</th>
                {SORT_COLUMNS.map((col) => {
                  const active = sort.key === col.key;
                  return (
                    <th
                      key={col.key}
                      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                      className="bg-[#12151e] py-2 pr-3 text-right font-medium last:pr-1"
                    >
                      <button
                        type="button"
                        onClick={() => onSort(col.key)}
                        className={`inline-flex items-center gap-1 transition-colors hover:text-slate-200 ${
                          active ? "font-semibold text-slate-200" : "text-slate-500"
                        }`}
                      >
                        {col.label}
                        {sortIndicator(col.key)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const iconStyle = { backgroundColor: r.color };
                return (
                  <tr
                    key={r.ticker}
                    className="border-b border-[#191e2b] text-[13px] transition-colors hover:bg-white/[0.025]"
                  >
                    <td className="py-2.5 pl-1">
                      <div className="flex items-center gap-2.5">
                        <span className="w-4 shrink-0 text-[11px] text-slate-600">{i + 1}</span>
                        <span
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white/90"
                          style={iconStyle}
                        >
                          {r.ticker.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <div className="max-w-[160px] truncate font-bold text-slate-100">{r.ticker}</div>
                          <div className="max-w-[240px] truncate text-[11px] text-slate-500">{r.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="num py-2.5 pr-3 text-right text-slate-300">
                      {r.weightPct === null ? "—" : `${r.weightPct.toFixed(2)}%`}
                    </td>
                    <td className="num py-2.5 pr-3 text-right font-semibold text-slate-100">{won(r.valueKRW)}</td>
                    <td className="num py-2.5 pr-3 text-right text-slate-300">{won(r.principalKRW)}</td>
                    <td className={`num py-2.5 pr-3 text-right font-medium ${toneCls(r.profitKRW)}`}>
                      {won(r.profitKRW)}
                    </td>
                    <td className={`num py-2.5 pr-1 text-right font-semibold ${toneCls(r.returnPct)}`}>
                      {pct(r.returnPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
