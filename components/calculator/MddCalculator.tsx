"use client";

import { useMemo, useState } from "react";
import MetricCard from "@/components/MetricCard";
import { calculateMdd } from "@/lib/mdd-calculator";
import type { MddInput } from "@/lib/calculator-types";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const panel = "rounded-2xl border border-[#2a3336] bg-[#191f20] p-5";

export default function MddCalculator({ input, onChange }: { input: MddInput; onChange: (input: MddInput) => void }) {
  const [submitted, setSubmitted] = useState(input);
  const result = useMemo(() => calculateMdd(submitted), [submitted]);
  const update = <K extends keyof MddInput>(key: K, value: MddInput[K]) => onChange({ ...input, [key]: value });

  return (
    <div className="space-y-5">
      <form className={panel} onSubmit={(event) => { event.preventDefault(); setSubmitted(input); }}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-[15px] font-bold text-white">입력값</h2><button type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-blue-700">계산 실행</button></div>
        <div className="mt-4 grid gap-3 text-[13px] text-slate-300 sm:grid-cols-2 lg:grid-cols-4">
          <TextInput label="티커" value={input.ticker} onChange={(value) => update("ticker", value.toUpperCase())} />
          <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">분석 기간</span><select value={input.analysisPeriod} onChange={(event) => update("analysisPeriod", event.target.value as MddInput["analysisPeriod"])} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none"><option value="6m">6개월</option><option value="1y">1년</option><option value="3y">3년</option><option value="5y">5년</option><option value="custom">직접 입력</option></select></label>
          <DateInput label="시작일" value={input.startDate} onChange={(value) => update("startDate", value)} />
          <DateInput label="종료일" value={input.endDate} onChange={(value) => update("endDate", value)} />
          <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">기준 통화</span><select value={input.currency} onChange={(event) => update("currency", event.target.value as MddInput["currency"])} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none"><option value="USD">USD</option><option value="KRW">KRW</option></select></label>
          <NumberInput label="초기 투자금" value={input.initialAmount} onChange={(value) => update("initialAmount", value)} />
          <NumberInput label="현재가" value={input.currentPrice} onChange={(value) => update("currentPrice", value)} />
          <NumberInput label="기준 고점" value={input.highPrice} onChange={(value) => update("highPrice", value)} />
          <NumberInput label="기준 저점" value={input.lowPrice} onChange={(value) => update("lowPrice", value)} />
        </div>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="현재가" value={`${submitted.currency === "USD" ? "$" : "₩"}${result.currentPrice.toLocaleString()}`} sub={`${submitted.ticker} 입력 기준`} tone="blue" />
        <MetricCard label="누적 최고점" value={`${result.peakPrice.toLocaleString()}`} sub={result.highDate} tone="green" />
        <MetricCard label="현재 낙폭" value={`${result.currentDrawdown}%`} sub="누적 최고점 대비" tone="orange" />
        <MetricCard label="최대 낙폭 MDD" value={`${result.maxDrawdown}%`} sub={`${result.highDate} → ${result.lowDate}`} tone="gray" />
        <MetricCard label="저점일" value={result.lowDate} sub="MDD 구간 저점" tone="orange" />
        <MetricCard label="회복일" value={result.recoveryDate ?? "진행중"} sub={result.recoveryDays ? `${result.recoveryDays}일 소요` : "아직 고점 미회복"} tone="blue" />
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">Drawdown chart</h2>
        <div className="h-[340px] min-w-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={result.series} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}><CartesianGrid stroke="#2a3336" strokeDasharray="3 3" /><XAxis dataKey="date" stroke="#94a3b8" tick={{ fontSize: 12 }} minTickGap={24} /><YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} unit="%" /><Tooltip contentStyle={{ background: "#111516", border: "1px solid #2a3336" }} /><ReferenceLine y={-10} stroke="#f59e0b" strokeDasharray="4 4" /><ReferenceLine y={-20} stroke="#fb923c" strokeDasharray="4 4" /><ReferenceLine y={-30} stroke="#ef4444" strokeDasharray="4 4" /><ReferenceLine y={-40} stroke="#991b1b" strokeDasharray="4 4" /><Area type="monotone" dataKey="drawdown" name="낙폭" stroke="#f97316" fill="#f97316" fillOpacity={0.24} /></AreaChart></ResponsiveContainer></div>
        <p className="mt-3 text-[12.5px] text-slate-500">{result.warning}</p>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">MDD 구간 표</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-[13px]"><thead className="text-slate-500"><tr className="border-b border-[#2a3336]"><th className="py-2">구간</th><th>고점일</th><th>저점일</th><th>MDD</th><th>회복일</th><th>회복 소요일</th></tr></thead><tbody>{result.segments.map((row) => <tr key={`${row.highDate}-${row.lowDate}`} className="border-b border-[#222a2c] text-slate-300 last:border-0"><td className="py-2 font-semibold text-white">{row.period}</td><td>{row.highDate}</td><td>{row.lowDate}</td><td className="text-red-300">{row.mdd}%</td><td>{row.recoveryDate ?? "진행중"}</td><td>{row.recoveryDays ? `${row.recoveryDays}일` : "-"}</td></tr>)}</tbody></table></div>
      </div>

      <div className={panel}>
        <h2 className="mb-4 text-[15px] font-bold text-white">가격/낙폭 상세 표</h2>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-[13px]"><thead className="text-slate-500"><tr className="border-b border-[#2a3336]"><th className="py-2">일자</th><th>종가</th><th>누적 최고점</th><th>Drawdown</th><th>평가금</th></tr></thead><tbody>{result.series.slice(-16).map((row) => <tr key={row.date} className="border-b border-[#222a2c] text-slate-300 last:border-0"><td className="py-2 font-semibold text-white">{row.date}</td><td>{row.close}</td><td>{row.peak}</td><td className="text-orange-300">{row.drawdown}%</td><td>{row.value.toLocaleString()}</td></tr>)}</tbody></table></div>
      </div>
    </div>
  );
}

function TextInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="number" step="any" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-xl border border-[#2a3336] bg-[#151a1b] px-4 py-3"><span className="text-[12px] text-slate-500">{label}</span><input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full bg-transparent font-bold text-slate-100 outline-none" /></label>; }
