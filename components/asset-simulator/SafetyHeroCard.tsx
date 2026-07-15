"use client";

import { useEffect, useState } from "react";
import type { SimulatorInputs } from "@/lib/asset-simulator-types";

type Props = {
  inputs: SimulatorInputs;
  onInputsChange: (inputs: SimulatorInputs) => void;
  targetMonthlyExpenseReal: number | null;
  onTargetMonthlyExpenseChange: (value: number | null) => void;
};

function parsePositiveNumber(raw: string): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function Field({ label, suffix, value, onChange, id, min = 0, step = 1 }: {
  label: string;
  suffix: string;
  value: number | null;
  onChange: (value: number | null) => void;
  id: string;
  min?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft((current) => Number(current) === value ? current : value === null ? "" : String(value)), [value]);
  return (
    <label className="min-w-0">
      <span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      <span className="mt-1 flex overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-[#334044] dark:bg-[#101618]">
        <input id={id} type="number" inputMode="decimal" min={min} step={step} value={draft} onChange={(event) => { setDraft(event.target.value); onChange(parsePositiveNumber(event.target.value)); }} className="min-w-0 flex-1 bg-transparent px-3 py-2 text-right text-[14px] font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 dark:text-white dark:focus:ring-blue-500/20" />
        <span className="flex items-center pr-2.5 text-[11px] font-semibold text-slate-500">{suffix}</span>
      </span>
    </label>
  );
}

export default function SafetyHeroCard({ inputs, onInputsChange, targetMonthlyExpenseReal, onTargetMonthlyExpenseChange }: Props) {
  return (
    <>
      <ol className="flex items-center justify-end gap-2 overflow-x-auto text-[12.5px] font-semibold text-slate-600 dark:text-slate-300" aria-label="안정성 체크 단계">
        {["목표 설정", "계좌 입력", "결과 확인"].map((label, index) => <li key={label} className="flex shrink-0 items-center gap-2"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${index === 0 ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-600 dark:border-slate-600 dark:bg-[#171d1e] dark:text-slate-300"}`}>{index + 1}</span><span>{label}</span>{index < 2 && <span aria-hidden className="ml-2 text-slate-400">›</span>}</li>)}
      </ol>
      <section aria-labelledby="safety-goal-heading" className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 id="safety-goal-heading" className="text-[17px] font-bold text-slate-900 dark:text-white"><span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">1</span>목표 설정</h2></div>
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">현재 가치 기준</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-[220px_220px_220px_minmax(0,1fr)] lg:items-end">
          <Field id="target-monthly-expense" label="목표 월생활비" suffix="만원" value={targetMonthlyExpenseReal} onChange={onTargetMonthlyExpenseChange} step={10} />
          <Field id="safety-simulation-years" label="기간" suffix="년" value={inputs.years} onChange={(value) => onInputsChange({ ...inputs, years: Math.max(1, Math.min(70, Math.round(value ?? 1))) })} min={1} />
          <Field id="safety-inflation-rate" label="물가상승률" suffix="%" value={inputs.inflationRate} onChange={(value) => onInputsChange({ ...inputs, inflationRate: Math.max(0, value ?? 0) })} step={0.1} />
          <p className="pb-2 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">목표 생활비와 자산은 물가상승률을 반영한 현재가치로 비교합니다.</p>
        </div>
      </section>
    </>
  );
}
