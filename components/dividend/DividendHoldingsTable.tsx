"use client";

import { formatWon, formatPercent } from "@/lib/format";
import { dividendHoldingWeightPct, type DividendHoldingRow } from "@/lib/mock-dividend-data";

interface Props {
  title: string;
  rows: DividendHoldingRow[];
  totalKRW: number;
}

const card = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

function formatOptionalNumber(value: number | undefined, digits = 2): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString("ko-KR", {
    maximumFractionDigits: digits,
  });
}

function formatOptionalMoney(value: number | undefined, currency: string | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  if (currency === "USD") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (currency === "KRW") return formatWon(value);
  return value.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
}

function formatWeight(row: DividendHoldingRow, totalKRW: number): string {
  const weight = dividendHoldingWeightPct(row, totalKRW);
  return weight === null ? "—" : formatPercent(weight, 1);
}

export default function DividendHoldingsTable({ title, rows, totalKRW }: Props) {
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="break-keep text-[15px] font-bold text-slate-300">{title}</h2>
          <span className="num shrink-0 text-[13px] font-semibold text-white">
            합계 {formatWon(totalKRW)}
          </span>
        </div>

        {/* 모바일: 카드 리스트 (가로 스크롤 없이 핵심 배당 정보 표시) */}
        <div className="space-y-2.5 lg:hidden">
          {rows.length === 0 && (
            <p className="rounded-xl border border-[#263234] bg-[#121819] p-4 text-center text-[13px] text-slate-500">
              배당 종목이 없습니다.
            </p>
          )}
          {rows.map((r, index) => (
            <div key={`${r.ticker}-${index}`} className="rounded-2xl border border-[#263234] bg-[#121819] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-white">{r.ticker}</div>
                  <div className="break-keep text-[12px] text-slate-400">{r.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {r.tag && (
                    <span className="whitespace-nowrap rounded-md bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">#{r.tag}</span>
                  )}
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[#1c2426] pt-2.5">
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">수량</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatOptionalNumber(r.quantity, 6)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">평균단가</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatOptionalMoney(r.averageCost, r.averageCostCurrency)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">현재가</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatOptionalMoney(r.currentPrice, r.currentPriceCurrency)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">내 배당률</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatPercent(r.myYieldPct, 2)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">비중</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatWeight(r, totalKRW)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">평가금액</div>
                  <div className="num truncate text-[12.5px] text-slate-200">{formatWon(r.valueKRW)}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">예상 연배당</div>
                  <div className="num truncate text-[12.5px] text-emerald-400">{formatWon(r.annualDividendKRW)}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* lg+ : 기존 데스크톱 표 */}
        <div className="scroll-dark hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1040px] text-[13px]">
            <thead>
              <tr className="border-b border-[#2a3336] text-left text-slate-400">
                <th className="px-3 py-2 font-medium">티커</th>
                <th className="px-3 py-2 font-medium">종목명</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">평균단가</th>
                <th className="px-3 py-2 text-right font-medium">현재가</th>
                <th className="px-3 py-2 text-right font-medium">내 배당률</th>
                <th className="px-3 py-2 text-right font-medium">비중</th>
                <th className="px-3 py-2 text-right font-medium">평가금액</th>
                <th className="px-3 py-2 text-right font-medium">예상 연배당</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-slate-500">
                    배당 종목이 없습니다.
                  </td>
                </tr>
              )}
              {rows.map((r, index) => (
                <tr key={`${r.ticker}-${index}`} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-semibold text-white">{r.ticker}</td>
                  <td className="px-3 py-2.5 text-slate-300">{r.name}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatOptionalNumber(r.quantity, 6)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatOptionalMoney(r.averageCost, r.averageCostCurrency)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatOptionalMoney(r.currentPrice, r.currentPriceCurrency)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatPercent(r.myYieldPct, 2)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatWeight(r, totalKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(r.valueKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-emerald-400">{formatWon(r.annualDividendKRW)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
