import type { TaxSavingRow } from "@/lib/mock-calendar-data";

interface Props {
  rows: TaxSavingRow[];
}

export default function TaxSavingTable({ rows }: Props) {
  return (
    <section className="rounded-2xl border border-[#2a3336] bg-[#191f20] p-4">
      <div className="mb-3">
        <h2 className="text-[15px] font-bold text-slate-200">종목별 예상 절세액</h2>
        <p className="text-[12px] text-slate-400">투자금 $10,000 기준 1회 절세 예상</p>
      </div>
      <div className="overflow-auto">
        <table className="w-full min-w-[360px] text-[12.5px]">
          <thead>
            <tr className="border-b border-[#2a3336] text-left text-slate-400">
              <th className="py-2 pr-3 font-medium">종목</th>
              <th className="px-3 py-2 text-right font-medium">1회 예상 절세액($)</th>
              <th className="py-2 pl-3 text-center font-medium">이번 달 Buy 여부</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.ticker} className="border-b border-[#20282a] last:border-0">
                <td className="py-2.5 pr-3 font-bold text-white">{row.ticker}</td>
                <td className="num px-3 py-2.5 text-right text-slate-200">{row.taxSavingUsd.toFixed(1)}</td>
                <td className="py-2.5 pl-3 text-center">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${row.shouldBuyThisMonth ? "bg-red-500/20 text-red-100 ring-1 ring-red-400/40" : "bg-white/10 text-slate-400"}`}>
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
