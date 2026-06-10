"use client";

import { useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import { calculateConversion } from "@/lib/conversion-calculator";
import type { ConversionInput } from "@/lib/calculator-types";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function ConversionCalculator({ input, onChange }: { input: ConversionInput; onChange: (input: ConversionInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const result = useMemo(() => calculateConversion(submitted), [submitted]);
  const update = <K extends keyof ConversionInput>(key: K, value: ConversionInput[K]) => onChange({ ...input, [key]: value });

  return (
    <div className="space-y-5">
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[15px] font-bold text-white">입력값</h2><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700">계산 실행</button></div>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-5">
          <TextInput label="매도 티커" value={input.sellTicker} onChange={(value) => update("sellTicker", value.toUpperCase())} />
          <TextInput label="매수 티커" value={input.buyTicker} onChange={(value) => update("buyTicker", value.toUpperCase())} />
          <NumberInput label="보유/매도 수량" value={input.sellShares} onChange={(value) => update("sellShares", value)} />
          <NumberInput label="매도 현재가($)" value={input.sellPrice} onChange={(value) => update("sellPrice", value)} />
          <NumberInput label="매수 현재가($)" value={input.buyPrice} onChange={(value) => update("buyPrice", value)} />
          <DateInput label="시작일" value={input.startDate} onChange={(value) => update("startDate", value)} />
          <DateInput label="종료일" value={input.endDate} onChange={(value) => update("endDate", value)} />
          <NumberInput label="평균 산출 기간(개월)" value={input.averageMonths} onChange={(value) => update("averageMonths", value)} />
          <NumberInput label="전환 기준 괴리율(%)" value={input.thresholdPct} onChange={(value) => update("thresholdPct", value)} />
          <NumberInput label="매도 수수료(%)" value={input.sellFeeRate} onChange={(value) => update("sellFeeRate", value)} />
          <NumberInput label="매수 수수료(%)" value={input.buyFeeRate} onChange={(value) => update("buyFeeRate", value)} />
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="현재 전환비" value={`${result.currentRatio}x`} sub={`${submitted.sellTicker} 1주 → ${submitted.buyTicker} ${result.currentRatio}주`} tone="blue" />
        <MetricCard label="기간 평균 전환비" value={`${result.averageRatio}x`} sub={`${submitted.startDate}~${submitted.endDate} 중 최근 ${submitted.averageMonths}개월 평균`} tone="gray" />
        <MetricCard label="평균 대비 괴리율" value={`${result.deviationPct}%`} sub={result.judgment} tone={result.deviationPct >= 0 ? "green" : "orange"} />
        <MetricCard label="매수 가능 수량" value={`${result.buyableShares.toLocaleString()}주`} sub={`순매도금 $${result.netSellAmount.toLocaleString()}`} tone="orange" />
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">전환비 추이</h2>
        <div className="h-[320px] min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={result.rows} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="#2a3336" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} minTickGap={24} />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} />
              <ReferenceLine y={result.averageRatio} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "평균", fill: "#f59e0b", fontSize: 12 }} />
              <Line type="monotone" dataKey="ratio" name="전환비" stroke="#60a5fa" strokeWidth={3} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="averageRatio" name="평균선" stroke="#f59e0b" strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-3 text-[12.5px] text-slate-500">{result.warning}</p>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">전환비 상세 표</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-[13px]"><thead className="text-slate-500"><tr className="border-b border-[#2a3336]"><th className="py-2">일자</th><th>매도 가격</th><th>매수 가격</th><th>전환비</th><th>평균 전환비</th><th>괴리율</th><th>판정</th></tr></thead><tbody>{result.rows.map((row) => <tr key={row.date} className="border-b border-[#222a2c] text-slate-300 last:border-0"><td className="py-2 font-semibold text-white">{row.date}</td><td>${row.sellPrice}</td><td>${row.buyPrice}</td><td>{row.ratio}x</td><td>{row.averageRatio}x</td><td>{row.deviationPct}%</td><td className={row.signal === "전환 우위" ? "text-green-400" : row.signal === "대기" ? "text-red-400" : "text-slate-300"}>{row.signal}</td></tr>)}</tbody></table></div>
        <p className="mt-4 rounded-xl border border-[#2a3336] bg-[#151a1b] p-4 text-[13px] text-slate-300">{result.judgment} 잔여 현금은 약 ${result.leftoverCash.toLocaleString()}입니다.</p>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
