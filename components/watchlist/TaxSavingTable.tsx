import type { TaxSavingRow } from "@/lib/mock-calendar-data";

interface Props {
  rows: TaxSavingRow[];
}

function formatTaxSaving(row: TaxSavingRow): string {
  if (row.isLoading) return "...";
  if (!row.canCalculate) return "—";
  return row.taxSavingUsd.toFixed(1);
}

export default function TaxSavingTable({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <div className="mb-2 sm:mb-3">
        <h2 className="text-[14px] font-bold text-slate-200 sm:text-[15px]">종목별 예상 절세액</h2>
        <p className="text-[11px] text-slate-400 sm:text-[12px]">투자금 $10,000 기준 1회 절세 예상</p>
      </div>
      <table className="w-full table-fixed text-[11.5px] sm:text-[12.5px]">
        <colgroup>
          <col className="w-[38%]" />
          <col className="w-[38%]" />
          <col className="w-[24%]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[#2a3336] text-left text-slate-400">
            <th className="py-1.5 pr-2 font-medium sm:py-2">종목</th>
            <th className="py-1.5 px-2 text-right font-medium sm:py-2">절세액($)</th>
            <th className="py-1.5 pl-2 text-center font-medium sm:py-2">Buy</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const warningText = row.warnings.join(" | ");
            return (
              <tr key={row.ticker} className="border-b border-[#20282a] last:border-0" title={warningText || undefined}>
                <td className="py-2 pr-2 font-bold text-white sm:py-2.5">{row.ticker}</td>
                <td className={`num py-2 px-2 text-right sm:py-2.5 ${row.canCalculate ? "text-slate-200" : row.isLoading ? "text-slate-400" : "text-amber-200"}`}>
                  {formatTaxSaving(row)}
                </td>
                <td className="py-2 pl-2 text-center sm:py-2.5">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:px-2 sm:py-1 sm:text-[11px] ${row.shouldBuyThisMonth ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/40" : "bg-white/10 text-slate-500"}`}>
                    {row.shouldBuyThisMonth ? "Buy" : "—"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
