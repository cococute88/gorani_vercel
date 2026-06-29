"use client";

import TableCsvMenu from "@/components/ui/TableCsvMenu";
import { formatWon, formatPercent } from "@/lib/format";
import { dividendHoldingWeightPct, type DividendHoldingRow } from "@/lib/mock-dividend-data";

interface Props {
  title: string;
  rows: DividendHoldingRow[];
  totalKRW: number;
  loading?: boolean;
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

function formatDividendRate(row: DividendHoldingRow): string {
  if (row.dividendDataStatus !== "available") return "—";
  return formatPercent(row.myYieldPct, 2);
}

function formatDividendAmount(row: DividendHoldingRow): string {
  if (row.dividendDataStatus !== "available") return row.dividendDataNote ?? "데이터 없음";
  return formatWon(row.annualDividendKRW);
}

export default function DividendHoldingsTable({ title, rows, totalKRW, loading = false }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section className="mb-6">
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="break-keep text-[15px] font-bold text-slate-300">{title}</h2>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <TableCsvMenu filename={`dividend-holdings-${title.replace(/\s+/g, "-")}-${today}.csv`} rows={rows} columns={[
              { header: "티커", value: (row) => row.ticker },
              { header: "종목명", value: (row) => row.name },
              { header: "수량(추정)", value: (row) => row.quantityEstimated ? `≈ ${formatOptionalNumber(row.quantity, 2)}주` : formatOptionalNumber(row.quantity, 6) },
              { header: "평균단가(추정)", value: (row) => row.averageCostEstimated ? `≈ ${formatOptionalMoney(row.averageCost, row.averageCostCurrency)}` : formatOptionalMoney(row.averageCost, row.averageCostCurrency) },
              { header: "현재가", value: (row) => formatOptionalMoney(row.currentPrice, row.currentPriceCurrency) },
              { header: "내 배당률", value: (row) => formatDividendRate(row) },
              { header: "비중", value: (row) => formatWeight(row, totalKRW) },
              { header: "평가금액", value: (row) => formatWon(row.valueKRW) },
              { header: "예상 연배당", value: (row) => formatDividendAmount(row) },
            ]} />
            {loading && <span className="text-[12px] text-blue-300">quote/dividend 조회 중</span>}
            <span className="num shrink-0 text-[13px] font-semibold text-white">
              합계 {formatWon(totalKRW)}
            </span>
          </div>
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
                  <div className="text-[10.5px] text-slate-500">수량(추정)</div>
                  <div className="num truncate text-[12.5px] text-slate-300">
                    {r.quantityEstimated ? `≈ ${formatOptionalNumber(r.quantity, 2)}주` : formatOptionalNumber(r.quantity, 6)}
                  </div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">평균단가(추정)</div>
                  <div className="num truncate text-[12.5px] text-slate-300">
                    {r.averageCostEstimated ? `≈ ${formatOptionalMoney(r.averageCost, r.averageCostCurrency)}` : formatOptionalMoney(r.averageCost, r.averageCostCurrency)}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[10.5px] text-slate-500">현재가</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatOptionalMoney(r.currentPrice, r.currentPriceCurrency)}</div>
                </div>
                <div className="min-w-0 text-right">
                  <div className="text-[10.5px] text-slate-500">내 배당률{r.myYieldBasis === "value" ? "(평가)" : ""}</div>
                  <div className="num truncate text-[12.5px] text-slate-300">{formatDividendRate(r)}</div>
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
                  {/* 예상 연배당: 라이트 모드 가독성 개선 — 흰 카드 위 노란색(amber)은 대비가 낮아
                      라이트는 파란색(blue-600), 다크는 기존 노란색(amber-300)을 유지한다. */}
                  <div className="truncate text-[12.5px] text-blue-600 dark:text-amber-300">{formatDividendAmount(r)}</div>
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
                <th className="px-3 py-2 text-right font-medium">수량(추정)</th>
                <th className="px-3 py-2 text-right font-medium">평균단가(추정)</th>
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
                  <td className="num px-3 py-2.5 text-right text-slate-300">
                    {r.quantityEstimated ? `≈ ${formatOptionalNumber(r.quantity, 2)}주` : formatOptionalNumber(r.quantity, 6)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">
                    {r.averageCostEstimated ? `≈ ${formatOptionalMoney(r.averageCost, r.averageCostCurrency)}` : formatOptionalMoney(r.averageCost, r.averageCostCurrency)}
                  </td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatOptionalMoney(r.currentPrice, r.currentPriceCurrency)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatDividendRate(r)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-300">{formatWeight(r, totalKRW)}</td>
                  <td className="num px-3 py-2.5 text-right text-slate-200">{formatWon(r.valueKRW)}</td>
                  {/* 예상 연배당: 라이트=파란색(blue-600, 흰 카드 대비 확보) / 다크=기존 노란색(amber-300). */}
                  <td className="px-3 py-2.5 text-right text-blue-600 dark:text-amber-300">{formatDividendAmount(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
