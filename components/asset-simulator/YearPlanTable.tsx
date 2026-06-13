import type { YearPlanRow } from "@/lib/asset-simulator-types";

type Props = {
  plans: YearPlanRow[];
  onChange: (plans: YearPlanRow[]) => void;
};

// 체크박스 3종을 표/카드 양쪽에서 공유한다. (모바일 카드는 짧은 라벨, sm+ 표는 전체 라벨)
const CHECKBOX_FIELDS: Array<{ key: keyof Pick<YearPlanRow, "isaContribution" | "pensionContribution" | "isaToPensionTransfer">; label: string; short: string }> = [
  { key: "isaContribution", label: "ISA적립", short: "ISA" },
  { key: "pensionContribution", label: "연금저축적립", short: "연금저축" },
  { key: "isaToPensionTransfer", label: "ISA연금이전", short: "연금이전" },
];

export default function YearPlanTable({ plans, onChange }: Props) {
  const updatePlan = (index: number, patch: Partial<YearPlanRow>) => {
    onChange(plans.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)));
  };

  const setMonthly = (index: number, raw: string) =>
    updatePlan(index, { monthlyContribution: Math.max(0, Number(raw) || 0) });

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">연도별 투자 계획표</h2>
        <p className="mt-1 break-keep text-[13px] text-slate-400">기본 계획은 원본처럼 초기 8년 월 300만원 적립입니다. 체크 여부와 월적립액을 바꾸면 즉시 재계산됩니다.</p>
      </div>

      {/* 모바일: 연도별 카드 (가로 스크롤 없이 카드 안에 모두 표시) */}
      <div className="space-y-2 sm:hidden">
        {plans.map((plan, index) => (
          <div key={plan.year} className="rounded-xl border border-[#263033] bg-[#111516] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] font-bold text-slate-100">{plan.year}</span>
              <label className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 break-keep text-[11px] text-slate-400">월적립(만원)</span>
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={plan.monthlyContribution}
                  onChange={(event) => setMonthly(index, event.target.value)}
                  className="num w-24 min-w-0 rounded-lg border border-[#303a3d] bg-[#0c1011] px-2 py-1.5 text-right text-[13px] font-semibold text-white outline-none focus:border-blue-500"
                />
              </label>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {CHECKBOX_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex items-center gap-1.5 rounded-lg border border-[#263033] bg-[#0c1011] px-2 py-1.5"
                >
                  <input
                    type="checkbox"
                    checked={plan[field.key]}
                    onChange={(event) => updatePlan(index, { [field.key]: event.target.checked })}
                    className="h-4 w-4 shrink-0 accent-blue-500"
                  />
                  <span className="break-keep text-[11px] leading-tight text-slate-300">{field.short}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* sm+ : 기존 표 레이아웃 */}
      <div className="hidden overflow-x-auto rounded-xl border border-[#263033] sm:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">년도</th>
              <th className="px-3 py-3 text-right">월적립액(만원)</th>
              {CHECKBOX_FIELDS.map((field) => (
                <th key={field.key} className="px-3 py-3 text-center">{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => (
              <tr key={plan.year} className="border-t border-[#263033] text-slate-200 odd:bg-white/[0.015]">
                <td className="px-3 py-2 font-bold text-slate-100">{plan.year}</td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    min={0}
                    step={10}
                    value={plan.monthlyContribution}
                    onChange={(event) => setMonthly(index, event.target.value)}
                    className="num w-28 rounded-lg border border-[#303a3d] bg-[#0c1011] px-2 py-1.5 text-right text-[13px] font-semibold text-white outline-none focus:border-blue-500"
                  />
                </td>
                {CHECKBOX_FIELDS.map((field) => (
                  <td key={field.key} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={plan[field.key]}
                      onChange={(event) => updatePlan(index, { [field.key]: event.target.checked })}
                      className="h-4 w-4 accent-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 break-keep text-[12px] text-slate-500">금액 입력 단위는 만원입니다. 모바일에서는 연도별 카드로 표시되고, 넓은 화면에서는 표 형태로 표시됩니다.</p>
    </section>
  );
}
