"use client";

import TableCsvMenu from "@/components/ui/TableCsvMenu";
import { formatWon, formatPercent } from "@/lib/format";
import { splitSmallHoldings } from "@/lib/portfolio-small-holdings";
import type { Holding } from "@/lib/portfolio-types";

interface Props {
  holdings: Holding[];
  selected: Record<string, boolean>;
  onToggle: (id: string) => void;
  onTickerChange: (id: string, ticker: string) => void;
  readOnly?: boolean;
  tickerMapNotice?: {
    tone: "success" | "error" | "info";
    text: string;
  } | null;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 포트폴리오 관리용 보유종목 리스트 (ticker 수정 가능, 확인상태 표시)
export default function HoldingsTable({
  holdings,
  selected,
  onToggle,
  onTickerChange,
  readOnly = false,
  tickerMapNotice = null,
}: Props) {
  const noticeToneClass =
    tickerMapNotice?.tone === "error"
      ? "border-rose-500/25 bg-rose-500/10 text-rose-300"
      : tickerMapNotice?.tone === "info"
        ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";

  // 소액(#소액 또는 20만원 미만) 항목은 표시 단계에서 숨겨 리스트를 짧게 유지한다.
  // (parser 원천/저장 데이터는 그대로 두고, 화면에서만 visible 만 렌더한다.)
  const { visible: visibleHoldings, hiddenCount } = splitSmallHoldings(holdings);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={card}>
      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold text-slate-300">보유종목 리스트</h2>
          {hiddenCount > 0 ? (
            <span className="shrink-0 whitespace-nowrap rounded-md border border-slate-600/40 bg-white/5 px-2 py-0.5 text-[11px] text-slate-400">
              소액 {hiddenCount}개 숨김
            </span>
          ) : null}
        </div>
        <TableCsvMenu filename={`portfolio-holdings-${today}.csv`} rows={visibleHoldings} columns={[
          { header: "금융사", value: (row) => row.broker },
          { header: "종류", value: (row) => row.assetType },
          { header: "상품명", value: (row) => row.cleanName ?? row.productName },
          { header: "티커", value: (row) => row.ticker },
          { header: "원금", value: (row) => formatWon(row.principalKRW) },
          { header: "평가금액", value: (row) => formatWon(row.valueKRW) },
          { header: "수익률", value: (row) => row.returnPct != null ? formatPercent(row.returnPct, 1) : "—" },
          { header: "확인상태", value: (row) => row.needsReview ? "확인 필요" : "인식됨" },
        ]} />
        {tickerMapNotice ? (
          <span className={`max-w-full break-keep rounded-md border px-2.5 py-1 text-[11.5px] ${noticeToneClass}`}>
            {tickerMapNotice.text}
          </span>
        ) : null}
      </div>

      {/* 모바일: 카드 리스트 (가로 스크롤 없이 카드 안에 핵심 정보 표시) */}
      <div className="space-y-2.5 lg:hidden">
        {visibleHoldings.length === 0 && (
          <p className="rounded-xl border border-[#263234] bg-[#121819] p-4 text-center text-[13px] text-slate-500">
            보유종목이 없습니다.
          </p>
        )}
        {visibleHoldings.map((h) => (
          <div key={h.id} className="rounded-2xl border border-[#263234] bg-[#121819] p-3">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={selected[h.id] ?? true}
                onChange={() => onToggle(h.id)}
                disabled={readOnly}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 break-keep text-[14px] font-semibold text-slate-100">
                    {h.cleanName ?? h.productName}
                  </span>
                  {h.needsReview ? (
                    <span className="shrink-0 whitespace-nowrap rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-400">확인 필요</span>
                  ) : (
                    <span className="shrink-0 whitespace-nowrap rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">인식됨</span>
                  )}
                </div>
                <div className="mt-1 break-keep text-[12px] text-slate-400">
                  {h.broker}
                  {h.assetType ? <span className="text-slate-600"> · {h.assetType}</span> : null}
                </div>
              </div>
            </div>

            {(h.symbolGroup || h.accountGroup || h.purposeGroup || h.statusGroup || h.tag) && (
              <div className="mt-2 flex flex-wrap gap-1">
                {h.symbolGroup && <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10.5px] text-blue-300">① {h.symbolGroup}</span>}
                {h.accountGroup && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] text-emerald-300">② {h.accountGroup}</span>}
                {h.purposeGroup && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] text-amber-300">③ {h.purposeGroup}</span>}
                {h.statusGroup && <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10.5px] text-purple-300">④ {h.statusGroup}</span>}
                {h.tag && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-slate-300">#{h.tag}</span>}
              </div>
            )}

            <label className="mt-2.5 flex items-center gap-2">
              <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-500">티커</span>
              <input
                value={h.ticker ?? ""}
                onChange={(e) => onTickerChange(h.id, e.target.value.toUpperCase())}
                readOnly={readOnly}
                className="num w-full min-w-0 rounded border border-[#2a3336] bg-[#11181a] px-2 py-1 text-[12.5px] text-white outline-none focus:border-blue-500 read-only:text-slate-400 disabled:opacity-60"
              />
            </label>

            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-[#1c2426] pt-2.5">
              <div className="min-w-0">
                <div className="text-[10.5px] text-slate-500">원금</div>
                <div className="num truncate text-[12.5px] text-slate-300">{formatWon(h.principalKRW)}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[10.5px] text-slate-500">평가금액</div>
                <div className="num truncate text-[12.5px] text-slate-200">{formatWon(h.valueKRW)}</div>
              </div>
              <div className="min-w-0 text-right">
                <div className="text-[10.5px] text-slate-500">수익률</div>
                <div className={`num truncate text-[12.5px] ${(h.returnPct ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {h.returnPct != null ? formatPercent(h.returnPct, 1) : "—"}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* lg+ : 기존 데스크톱 표 */}
      <div className="scroll-dark hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead>
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="px-2 py-2 font-medium"></th>
              <th className="px-3 py-2 font-medium">금융사</th>
              <th className="px-3 py-2 font-medium">종류</th>
              <th className="px-3 py-2 font-medium">상품명 / 태그</th>
              <th className="px-3 py-2 font-medium">티커</th>
              <th className="px-3 py-2 text-right font-medium">원금</th>
              <th className="px-3 py-2 text-right font-medium">평가금액</th>
              <th className="px-3 py-2 text-right font-medium">수익률</th>
              <th className="px-3 py-2 font-medium">확인상태</th>
            </tr>
          </thead>
          <tbody>
            {visibleHoldings.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-500">보유종목이 없습니다.</td>
              </tr>
            )}
            {visibleHoldings.map((h) => (
              <tr key={h.id} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                <td className="px-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected[h.id] ?? true}
                    onChange={() => onToggle(h.id)}
                    disabled={readOnly}
                    className="h-4 w-4 accent-blue-600"
                  />
                </td>
                <td className="px-3 py-2.5 text-slate-300">{h.broker}</td>
                <td className="px-3 py-2.5 text-slate-400">{h.assetType}</td>
                <td className="px-3 py-2.5 text-slate-200">
                  <div>{h.cleanName ?? h.productName}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {h.symbolGroup && <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10.5px] text-blue-300">① {h.symbolGroup}</span>}
                    {h.accountGroup && <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10.5px] text-emerald-300">② {h.accountGroup}</span>}
                    {h.purposeGroup && <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10.5px] text-amber-300">③ {h.purposeGroup}</span>}
                    {h.statusGroup && <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10.5px] text-purple-300">④ {h.statusGroup}</span>}
                    {h.tag && <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10.5px] text-slate-300">#{h.tag}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <input
                    value={h.ticker ?? ""}
                    onChange={(e) => onTickerChange(h.id, e.target.value.toUpperCase())}
                    readOnly={readOnly}
                    className="num w-[88px] rounded border border-[#2a3336] bg-[#11181a] px-2 py-1 text-[12.5px] text-white outline-none focus:border-blue-500 read-only:text-slate-400 disabled:opacity-60"
                  />
                </td>
                <td className="num px-3 py-2.5 text-right text-slate-300">{formatWon(h.principalKRW)}</td>
                <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(h.valueKRW)}</td>
                <td className={`num px-3 py-2.5 text-right ${(h.returnPct ?? 0) >= 0 ? "text-red-400" : "text-blue-400"}`}>
                  {h.returnPct != null ? formatPercent(h.returnPct, 1) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  {h.needsReview ? (
                    <span className="rounded-md bg-amber-500/10 px-2 py-0.5 text-[11.5px] text-amber-400">확인 필요</span>
                  ) : (
                    <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[11.5px] text-emerald-400">인식됨</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
