import type { SimulatorInputs } from "@/lib/asset-simulator-types";

const INPUTS: Array<{ key: keyof SimulatorInputs; label: string; suffix: string; step?: number; min?: number }> = [
  { key: "startYear", label: "시작 연도", suffix: "년", step: 1, min: 2020 },
  { key: "years", label: "시뮬레이션 기간", suffix: "년", step: 1, min: 1 },
  { key: "initialIsa", label: "초기 ISA 금액", suffix: "만원", step: 100, min: 0 },
  { key: "initialPension", label: "초기 연금저축 금액", suffix: "만원", step: 100, min: 0 },
  { key: "initialTaxable", label: "초기 위탁계좌 금액", suffix: "만원", step: 100, min: 0 },
  { key: "annualReturnRate", label: "연 수익률", suffix: "%", step: 0.1, min: -50 },
  { key: "inflationRate", label: "물가상승률", suffix: "%", step: 0.1, min: 0 },
  { key: "withdrawalRate", label: "인출률", suffix: "%", step: 0.1, min: 0 },
  { key: "withdrawalGrowthRate", label: "인출 증가율", suffix: "%", step: 0.1, min: 0 },
  { key: "withdrawalDelayYears", label: "인출 시작 지연 기간", suffix: "년", step: 1, min: 0 },
];

const MONEY_KEYS: Array<keyof SimulatorInputs> = ["initialIsa", "initialPension", "initialTaxable"];

type Props = {
  inputs: SimulatorInputs;
  onChange: (nextInputs: SimulatorInputs) => void;
  onReset: () => void;
};

export default function SimulatorInputPanel({ inputs, onChange, onReset }: Props) {
  const updateInput = (key: keyof SimulatorInputs, rawValue: string) => {
    const parsed = Number(rawValue);
    const nextValue = Number.isFinite(parsed) ? parsed : 0;
    const value = MONEY_KEYS.includes(key) ? nextValue * 10000 : nextValue;
    onChange({ ...inputs, [key]: value });
  };

  const displayValue = (key: keyof SimulatorInputs) =>
    MONEY_KEYS.includes(key) ? Math.round(inputs[key] / 10000) : inputs[key];

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white">입력 폼</h2>
          <p className="mt-1 text-[13px] text-slate-400">값을 바꾸면 3A preview 결과가 즉시 갱신됩니다.</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-xl border border-slate-600 px-3 py-2 text-[13px] font-bold text-slate-200 transition-colors hover:bg-white/5 sm:w-auto"
        >
          초기화
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {INPUTS.map((item) => (
          <label key={item.key} className="rounded-xl border border-[#263033] bg-[#111516] p-3">
            <span className="text-[12px] font-semibold text-slate-400">{item.label}</span>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={item.min}
                step={item.step ?? 1}
                value={displayValue(item.key)}
                onChange={(event) => updateInput(item.key, event.target.value)}
                className="num min-w-0 flex-1 rounded-lg border border-[#303a3d] bg-[#0c1011] px-3 py-2 text-right text-[14px] font-bold text-white outline-none focus:border-blue-500"
              />
              <span className="w-10 text-[12px] font-semibold text-slate-500">{item.suffix}</span>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
