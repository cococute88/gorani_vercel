import type { TaxSavingRow } from "@/lib/mock-calendar-data";

interface Props {
  rows: TaxSavingRow[];
}

export default function TaxSavingTable({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-3 sm:p-4">
      <div className="mb-2 sm:mb-3">
        <h2 className="text-[14px] font-bold text-slate-200 sm:text-[15px]">종목별 예상 절세액</h2>
        <p className="text-[11px] text-slate-400 sm:text-[12px]">투자금 $10,000 기준 1회 절세 예상</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] text-[11.5px] sm:min-w-[360px] sm:text-[12.5px]">
          <thead>
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="py-1.5 pr-2 font-medium sm:py-2 sm:pr-3">종목</th>
              <th className="px-2 py-1.5 text-right font-medium sm:px-3 sm:py-2">절세액($)</th>
              <th className="py-1.5 pl-2 text-center font-medium sm:py-2 sm:pl-3">Buy</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="border-b border-[#20282a] last:border-0">
                <td className="py-2 pr-2 font-bold text-white sm:py-2.5 sm:pr-3">{row.ticker}</td>
                <td className="num px-2 py-2 text-right text-slate-200 sm:px-3 sm:py-2.5">{row.taxSavingUsd.toFixed(1)}</td>
                <td className="py-2 pl-2 text-center sm:py-2.5 sm:pl-3">
                  <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-bold sm:px-2 sm:py-1 sm:text-[11px] ${row.shouldBuyThisMonth ? "bg-red-500/20 text-red-200 ring-1 ring-red-400/40" : "bg-white/10 text-slate-500"}`}>
                    {row.shouldBuyThisMonth ? "Buy" : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
