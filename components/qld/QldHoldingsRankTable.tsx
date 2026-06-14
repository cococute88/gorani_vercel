"use client";

import type { PerformanceQldResult } from "@/lib/performance-qld-from-snapshots";

const won = (v: number | null) => (v === null ? "—" : `${Math.round(v).toLocaleString("ko-KR")}원`);
const pct = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}%`);
const toneCls = (v: number | null) =>
  v === null || v === 0 ? "text-slate-400" : v > 0 ? "text-emerald-400" : "text-rose-400";

// 스크린샷 3: 종목 랭킹 테이블 (Top 8) — 촉촉한 다크 테이블
export default function QldHoldingsRankTable({ data }: { data: PerformanceQldResult }) {
  const rows = data.rankings;

  return (
    <div className="rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[15px] font-bold text-slate-100">종목 랭킹</span>
          {!data.flags.hasProfitRanking && rows.length > 0 && (
            <p className="mt-1 text-[11.5px] text-amber-300">
              원금 정보가 부족한 종목은 손익과 수익률을 표시하지 않습니다.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
            Top 8
          </span>
          <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
            평가금액순
          </span>
        </div>
      </div>

      {rows.length === 0 && (
        <div className="rounded-xl border border-[#242938] bg-[#0e111a] px-4 py-8 text-center text-[13px] text-slate-500">
          {data.flags.hasHoldings
            ? "최신 스냅샷 보유종목에 유효한 평가금액이 없어 랭킹을 표시할 수 없습니다."
            : "최신 스냅샷에 보유종목이 없어 랭킹을 표시할 수 없습니다."}
        </div>
      )}

      {/* 모바일: 랭킹 카드 (가로 스크롤 없이 핵심 지표 표시) */}
      {rows.length > 0 && (
      <div className="space-y-2.5 lg:hidden">
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

      {/* lg+ : 기존 데스크톱 표 */}
      {rows.length > 0 && (
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-[#222838] text-[11.5px] text-slate-500">
              <th className="py-2 pl-1 text-left font-medium">종목</th>
              <th className="py-2 pr-3 text-right font-medium">비중</th>
              <th className="py-2 pr-3 text-right font-medium">평가금액</th>
              <th className="py-2 pr-3 text-right font-medium">투자원금</th>
              <th className="py-2 pr-3 text-right font-medium">누적 손익</th>
              <th className="py-2 pr-1 text-right font-medium">누적 수익률</th>
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
