"use client";

import { useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import { simulateDividendCapture } from "@/lib/dividend-capture-calculator";
import type { DividendCaptureInput } from "@/lib/calculator-types";
import { CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function DividendCaptureSimulator({ input, onChange }: { input: DividendCaptureInput; onChange: (input: DividendCaptureInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const result = useMemo(() => simulateDividendCapture(submitted), [submitted]);
  const update = <K extends keyof DividendCaptureInput>(key: K, value: DividendCaptureInput[K]) => onChange({ ...input, [key]: value });

  return (
    <div className="space-y-5">
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[15px] font-bold text-white">입력값</h2>
          <button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700">계산 실행</button>
        </div>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="티커" value={input.ticker} onChange={(value) => update("ticker", value.toUpperCase())} />
          <NumberInput label="투자금($)" value={input.investmentAmount} onChange={(value) => update("investmentAmount", value)} />
          <DateInput label="매수 기준일" value={input.buyDate} onChange={(value) => update("buyDate", value)} />
          <DateInput label="배당락일" value={input.exDividendDate} onChange={(value) => update("exDividendDate", value)} />
          <NumberInput label="매수 기준가($)" value={input.buyPrice} onChange={(value) => update("buyPrice", value)} />
          <NumberInput label="배당락 후 저가($)" value={input.postExLowPrice} onChange={(value) => update("postExLowPrice", value)} />
          <NumberInput label="회복/매도가($)" value={input.recoveryPrice} onChange={(value) => update("recoveryPrice", value)} />
          <NumberInput label="주당 배당($)" value={input.dividendPerShare} onChange={(value) => update("dividendPerShare", value)} />
          <NumberInput label="세율(%)" value={input.taxRate} onChange={(value) => update("taxRate", value)} />
          <NumberInput label="수수료(%)" value={input.commissionRate} onChange={(value) => update("commissionRate", value)} />
          <NumberInput label="슬리피지(%)" value={input.slippageRate} onChange={(value) => update("slippageRate", value)} />
          <NumberInput label="분석 기간(개월)" value={input.analysisMonths} onChange={(value) => update("analysisMonths", value)} />
          <NumberInput label="최대 보유일" value={input.maxHoldingDays} onChange={(value) => update("maxHoldingDays", value)} />
          <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3">
            <span className="text-[12px] text-slate-500">매도 기준</span>
            <select value={input.sellBasis} onChange={(event) => update("sellBasis", event.target.value as DividendCaptureInput["sellBasis"])} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none">
              <option value="recovery">배당락 회복 시 매도</option>
              <option value="days">지정 보유일 기준</option>
            </select>
          </label>
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="매수 가능 수량" value={`${result.shares.toLocaleString()}주`} sub={`${submitted.ticker} 기준`} tone="blue" />
        <MetricCard label="세후 배당금" value={`$${result.netDividend.toLocaleString()}`} sub={`세율 ${submitted.taxRate}% 반영`} tone="green" />
        <MetricCard label="예상 가격 하락" value={`-$${result.expectedDrop.toLocaleString()}`} sub="매수가 - 배당락 저가" tone="orange" />
        <MetricCard label="손익분기 가격" value={`$${result.breakevenPrice.toLocaleString()}`} sub="세후 배당·비용 반영" tone="blue" />
        <MetricCard label="성공률" value={`${result.successRate}%`} sub={`${result.rows.length}회 샘플`} tone="green" />
        <MetricCard label="평균 회복일" value={`${result.averageRecoveryDays}일`} sub={`평균 수익률 ${result.averageProfitPct}%`} tone="gray" />
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">성공/실패 분포</h2>
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="recoveryDays" name="회복일" unit="일" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <YAxis dataKey="profitPct" name="수익률" unit="%" stroke="#94a3b8" tick={{ fontSize: 12 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
              <Scatter data={result.rows} name="회차">
                {result.rows.map((entry) => <Cell key={entry.exDate} fill={entry.result === "성공" ? "#22c55e" : "#ef4444"} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[12.5px] text-slate-500">{result.warning}</p>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">회차별 상세 결과</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-[13px]">
            <thead className="text-slate-500"><tr className="border-b border-[#2a3336]"><th className="py-2">회차</th><th>배당락일</th><th>매수가</th><th>배당락 저가</th><th>매도가</th><th>세후 배당</th><th>가격손익</th><th>총손익</th><th>수익률</th><th>회복일</th><th>손익분기</th><th>결과</th><th>판정</th></tr></thead>
            <tbody>{result.rows.map((row) => <tr key={row.exDate} className="border-b border-[#222a2c] text-slate-300 last:border-0"><td className="py-2 font-semibold text-white">{row.round}</td><td>{row.exDate}</td><td>${row.buyPrice}</td><td>${row.exLowPrice}</td><td>${row.sellPrice}</td><td>${row.netDividend}</td><td>${row.pricePnL}</td><td>${row.totalPnL}</td><td>{row.profitPct}%</td><td>{row.recoveryDays}일</td><td>${row.breakevenPrice}</td><td className={row.result === "성공" ? "text-green-400" : "text-red-400"}>{row.result}</td><td>{row.note}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>;
}
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>;
}
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>;
}
