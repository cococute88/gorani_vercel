"use client";

import { useEffect, useState } from "react";
import type { SimulatorInputs } from "@/lib/asset-simulator-types";

const INPUTS: Array<{ key: keyof SimulatorInputs; label: string; suffix: string; step?: number; min?: number; max?: number }> = [
  { key: "startYear", label: "시작년도", suffix: "년", step: 1, min: 2020 },
  { key: "years", label: "시뮬레이션 기간(년)", suffix: "년", step: 1, min: 1, max: 60 },
  { key: "annualReturnRate", label: "예상 연간 수익률(%)", suffix: "%", step: 0.1, min: -50 },
  { key: "inflationRate", label: "물가상승률(%)", suffix: "%", step: 0.1, min: 0 },
  { key: "initialIsa", label: "기존 ISA 잔고(만원)", suffix: "만원", step: 100, min: 0 },
  { key: "initialPension", label: "기존 연금저축 잔고(만원)", suffix: "만원", step: 100, min: 0 },
  { key: "reserveCash", label: "추가 투입 예비금(만원)", suffix: "만원", step: 100, min: 0 },
  { key: "initialTaxableDividend", label: "배당용 위탁잔고(만원)", suffix: "만원", step: 100, min: 0 },
  { key: "withdrawalRate", label: "인출률(%)", suffix: "%", step: 0.1, min: 0 },
  { key: "withdrawalGrowthRate", label: "인출금 연간 증액률(%)", suffix: "%", step: 0.1, min: 0 },
  { key: "withdrawalDelayYears", label: "인출 미룰 년수(1~15)", suffix: "년", step: 1, min: 1, max: 15 },
];

const INTEGER_KEYS: Array<keyof SimulatorInputs> = ["startYear", "years", "withdrawalDelayYears"];
const PERCENT_KEYS = INPUTS.filter((input) => input.suffix === "%").map((input) => input.key);

function displayInputValue(key: keyof SimulatorInputs, value: number) {
  return PERCENT_KEYS.includes(key) ? value.toFixed(2) : String(value);
}

type Props = {
  inputs: SimulatorInputs;
  onChange: (nextInputs: SimulatorInputs) => void;
  onReset: () => void;
  onSave?: () => Promise<void> | void;
  saving?: boolean;
  saveMessage?: string | null;
  saveError?: string | null;
  exitMode?: boolean;
  onExitModeChange?: (next: boolean) => void;
};

export default function SimulatorInputPanel({ inputs, onChange, onReset, onSave, saving = false, saveMessage, saveError, exitMode = false, onExitModeChange }: Props) {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  // 현재 편집(포커스) 중인 항목만 사용자의 입력 중 텍스트를 보존하고,
  // 나머지 항목은 항상 최신 inputs 값을 그대로 표시한다.
  const [focusedKey, setFocusedKey] = useState<keyof SimulatorInputs | null>(null);

  // 저장값 로딩(하이드레이션)·초기화 등으로 inputs 가 바뀌면 화면 표시값(draft)을
  // 다시 동기화한다. 편집 중인 항목은 입력 도중 값이 덮어써지지 않도록 건너뛴다.
  useEffect(() => {
    setDraftValues((current) => {
      const next = { ...current };
      for (const item of INPUTS) {
        if (item.key === focusedKey) continue;
        next[item.key] = displayInputValue(item.key, inputs[item.key]);
      }
      return next;
    });
  }, [inputs, focusedKey]);

  const updateInput = (key: keyof SimulatorInputs, rawValue: string) => {
    const item = INPUTS.find((input) => input.key === key);
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const min = item?.min ?? 0;
    const max = item?.max ?? Number.POSITIVE_INFINITY;
    const value = INTEGER_KEYS.includes(key) ? Math.round(Math.min(max, Math.max(min, safe))) : Math.min(max, Math.max(min, safe));
    onChange({ ...inputs, [key]: value });
    return value;
  };

  const handleBlur = (key: keyof SimulatorInputs) => {
    const value = updateInput(key, draftValues[key] ?? String(inputs[key]));
    setDraftValues((current) => ({ ...current, [key]: displayInputValue(key, value) }));
    setFocusedKey((current) => (current === key ? null : current));
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-[#273032] dark:bg-[#171d1e] dark:shadow-xl dark:shadow-black/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">기본 설정 입력폼</h2>
          <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">Streamlit 원본 자산 시뮬레이터의 입력 순서와 항목을 기준으로 구성했습니다.</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
          {/* "지금 EXIT?" : Save 버튼 왼쪽의 로컬 UI 체크박스 (저장하지 않음, 새로고침 시 초기화) */}
          <label
            className={`flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-xl border px-3 py-2 text-[13px] font-bold transition-colors ${
              exitMode
                ? "border-cyan-400 bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"
                : "border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-[#303a3d] dark:text-slate-300 dark:hover:bg-white/5"
            }`}
            title="체크 시 연도별 투자 계획표를 무시하고 현재 보유 자산만으로 계산합니다."
          >
            <input
              type="checkbox"
              checked={exitMode}
              onChange={(event) => onExitModeChange?.(event.target.checked)}
              className="h-4 w-4 accent-cyan-500"
            />
            지금 EXIT?
          </label>
          {saveMessage ? (
            <span className="text-[12px] font-semibold text-emerald-400" role="status">
              {saveMessage}
            </span>
          ) : null}
          {saveError ? (
            <span className="text-[12px] font-semibold text-red-400" role="alert">
              {saveError}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void onSave?.()}
            disabled={saving}
            className="flex-1 rounded-xl bg-blue-600 px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600 sm:flex-none"
          >
            {saving ? "저장 중..." : "Save"}
          </button>
          <button
            type="button"
            onClick={onReset}
            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-[13px] font-bold text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-white/5 sm:flex-none"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INPUTS.map((item) => (
          <label key={item.key} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-[#263033] dark:bg-[#111516]">
            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={item.min}
                max={item.max}
                step={item.step ?? 1}
                value={draftValues[item.key] ?? displayInputValue(item.key, inputs[item.key])}
                onFocus={() => setFocusedKey(item.key)}
                onChange={(event) => {
                  const raw = event.target.value;
                  setDraftValues((current) => ({ ...current, [item.key]: raw }));
                  updateInput(item.key, raw);
                }}
                onBlur={() => handleBlur(item.key)}
                className="num min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-right text-[14px] font-bold text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 dark:border-[#303a3d] dark:bg-[#0c1011] dark:text-white"
              />
              <span className="w-12 text-[12px] font-semibold text-slate-500">{item.suffix}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
