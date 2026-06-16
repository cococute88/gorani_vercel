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

type Props = {
  inputs: SimulatorInputs;
  onChange: (nextInputs: SimulatorInputs) => void;
  onReset: () => void;
  onSave?: () => Promise<void> | void;
  saving?: boolean;
  saveMessage?: string | null;
  saveError?: string | null;
};

export default function SimulatorInputPanel({ inputs, onChange, onReset, onSave, saving = false, saveMessage, saveError }: Props) {
  const updateInput = (key: keyof SimulatorInputs, rawValue: string) => {
    const item = INPUTS.find((input) => input.key === key);
    const parsed = Number(rawValue);
    const safe = Number.isFinite(parsed) ? parsed : 0;
    const min = item?.min ?? 0;
    const max = item?.max ?? Number.POSITIVE_INFINITY;
    const value = INTEGER_KEYS.includes(key) ? Math.round(Math.min(max, Math.max(min, safe))) : Math.min(max, Math.max(min, safe));
    onChange({ ...inputs, [key]: value });
  };

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white">기본 설정 입력폼</h2>
          <p className="mt-1 text-[13px] text-slate-400">Streamlit 원본 자산 시뮬레이터의 입력 순서와 항목을 기준으로 구성했습니다.</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
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
            className="flex-1 rounded-xl border border-slate-600 px-3 py-2 text-[13px] font-bold text-slate-200 transition-colors hover:bg-white/5 sm:flex-none"
          >
            초기화
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {INPUTS.map((item) => (
          <label key={item.key} className="rounded-xl border border-[#263033] bg-[#111516] p-3">
            <span className="text-[12px] font-semibold text-slate-400">{item.label}</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={item.min}
                max={item.max}
                step={item.step ?? 1}
                value={inputs[item.key]}
                onChange={(event) => updateInput(item.key, event.target.value)}
                className="num min-w-0 flex-1 rounded-lg border border-[#303a3d] bg-[#0c1011] px-3 py-2 text-right text-[14px] font-bold text-white outline-none focus:border-blue-500"
              />
              <span className="w-12 text-[12px] font-semibold text-slate-500">{item.suffix}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
