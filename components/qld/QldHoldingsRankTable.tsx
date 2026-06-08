"use client";

import { QLD_RANK_ROWS } from "@/lib/qldDashboardData";

const won = (v: number) => v.toLocaleString("ko-KR");
const wonSigned = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toLocaleString("ko-KR")}원`;
const pctSigned = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(2)}%`;
const toneCls = (v: number) => (v > 0 ? "text-emerald-400" : v < 0 ? "text-rose-400" : "text-slate-400");

// 스크린샷 3: 종목 랭킹 테이블 (Top 8) — 촉촉한 다크 테이블
export default function QldHoldingsRankTable() {
  return (
    <div className="rounded-[18px] border border-[#242938] bg-[#12151e] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-bold text-slate-100">종목 랭킹</span>
        <span className="rounded-md border border-[#2a3142] bg-[#0e111a] px-2 py-1 text-[11px] font-semibold text-slate-400">
          Top 8
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <thead>
            <tr className="border-b border-[#222838] text-[11.5px] text-slate-500">
              <th className="py-2 pl-1 text-left font-medium">종목</th>
              <th className="py-2 pr-3 text-right font-medium">평균 매수가</th>
              <th className="py-2 pr-3 text-right font-medium">비중</th>
              <th className="py-2 pr-3 text-right font-medium">평가금액</th>
              <th className="py-2 pr-3 text-right font-medium">전일대비 수익금</th>
              <th className="py-2 pr-3 text-right font-medium">전일대비 수익률</th>
              <th className="py-2 pr-1 text-right font-medium">누적 수익</th>
            </tr>
          </thead>
          <tbody>
            {QLD_RANK_ROWS.map((r, i) => {
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
                        <div className="font-bold text-slate-100">{r.ticker}</div>
                        <div className="truncate text-[11px] text-slate-500">{r.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num py-2.5 pr-3 text-right text-slate-300">{r.avgPrice}</td>
                  <td className="num py-2.5 pr-3 text-right text-slate-300">{r.weight.toFixed(2)}%</td>
                  <td className="num py-2.5 pr-3 text-right font-semibold text-slate-100">{won(r.value)}원</td>
                  <td className={`num py-2.5 pr-3 text-right font-medium ${toneCls(r.dayProfit)}`}>
                    {wonSigned(r.dayProfit)}
                  </td>
                  <td className={`num py-2.5 pr-3 text-right font-medium ${toneCls(r.dayProfitRate)}`}>
                    {pctSigned(r.dayProfitRate)}
                  </td>
                  <td className="num py-2.5 pr-1 text-right">
                    <div className={`font-semibold ${toneCls(r.cumProfit)}`}>{wonSigned(r.cumProfit)}</div>
                    <div className={`text-[11px] ${toneCls(r.cumProfitRate)}`}>{pctSigned(r.cumProfitRate)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
