"use client";

import { Pencil, Trash2 } from "lucide-react";
import { formatWon, formatPercent } from "@/lib/format";
import type { DividendHoldingRow } from "@/lib/mock-dividend-data";

interface Props {
  rows: DividendHoldingRow[];
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

// 보유 배당 종목 리스트 (편집/삭제는 UI만)
export default function DividendHoldingsTable({ rows }: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <h2 className="mb-4 text-[15px] font-bold text-slate-300">보유 배당 종목</h2>

        {/* 모바일: 카드 리스트 (가로 스크롤 없이 핵심 배당 정보 표시) */}
        <div className="space-y-2.5 lg:hidden">
          {rows.length === 0 && (
            <p className="rounded-xl border border-[#263234] bg-[#121819] p-4 text-center text-[13px] text-slate-500">
              배당 종목이 없습니다.
            </p>
          )}
          {rows.map((r) => (
            <div key={r.ticker} className="rounded-2xl border border-[#263234] bg-[#121819] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">{r.ticker}</div>
                  <div className="break-keep text-[12px] text-slate-400">{r.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.tag && (
                    <span className="whitespace-nowrap rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">#{r.tag}</span>
                  )}
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white" title="편집">
                    <Pencil size={13} />
                  </button>
                  <button className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-red-400" title="삭제">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[#1c2426] pt-2.5">
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">평가금액</div>
                  <div className="num truncate text-[12.5px] text-slate-200">{formatWon(r.valueKRW)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">예상 연배당</div>
                  <div className="num truncate text-[12.5px] text-emerald-400">{formatWon(r.annualDividendKRW)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">예상 배당률</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatPercent(r.expectedYieldPct, 2)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">내 배당률</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatPercent(r.myYieldPct, 2)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* lg+ : 기존 데스크톱 표 */}
        <div className="scroll-dark hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-[#2a3336] text-left text-slate-400">
                <th className="px-3 py-2 font-medium">티커</th>
                <th className="px-3 py-2 font-medium">종목명</th>
                <th className="px-3 py-2 text-right font-medium">평가금액</th>
                <th className="px-3 py-2 text-right font-medium">예상 연배당</th>
                <th className="px-3 py-2 text-right font-medium">예상 배당률</th>
                <th className="px-3 py-2 text-right font-medium">내 배당률</th>
                <th className="px-3 py-2 font-medium">태그</th>
                <th className="px-3 py-2 text-right font-medium">관리</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                    배당 종목이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.ticker} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-semibold text-white">{r.ticker}</td>
                  <td className="px-3 py-2.5 text-slate-300">{r.name}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(r.valueKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-emerald-400">{formatWon(r.annualDividendKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatPercent(r.expectedYieldPct, 2)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatPercent(r.myYieldPct, 2)}</td>
                  <td className="px-3 py-2.5">
                    {r.tag ? (
                      <span className="rounded-md bg-white/5 px-2 py-0.5 text-[11.5px] text-slate-300">#{r.tag}</span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white" title="편집">
                        <Pencil size={13} />
                      </button>
                      <button className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-red-400" title="삭제">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
