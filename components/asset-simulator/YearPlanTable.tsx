import type { YearPlanRow } from "@/lib/asset-simulator-types";

type Props = {
  plans: YearPlanRow[];
  onChange: (plans: YearPlanRow[]) => void;
};

export default function YearPlanTable({ plans, onChange }: Props) {
  const updatePlan = (index: number, patch: Partial<YearPlanRow>) => {
    onChange(plans.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)));
  };

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">연도별 투자 계획표</h2>
        <p className="mt-1 text-[13px] text-slate-400">기본 계획은 원본처럼 초기 8년 월 300만원 적립입니다. 체크 여부와 월적립액을 바꾸면 즉시 재계산됩니다.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#263033]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">년도</th>
              <th className="px-3 py-3 text-right">월적립액(만원)</th>
              <th className="px-3 py-3 text-center">ISA적립</th>
              <th className="px-3 py-3 text-center">연금저축적립</th>
              <th className="px-3 py-3 text-center">ISA연금이전</th>
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
                    onChange={(event) => updatePlan(index, { monthlyContribution: Math.max(0, Number(event.target.value) || 0) })}
                    className="num w-28 rounded-lg border border-[#303a3d] bg-[#0c1011] px-2 py-1.5 text-right text-[13px] font-semibold text-white outline-none focus:border-blue-500"
                  />
                </td>
                {(["isaContribution", "pensionContribution", "isaToPensionTransfer"] as const).map((key) => (
                  <td key={key} className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={plan[key]}
                      onChange={(event) => updatePlan(index, { [key]: event.target.checked })}
                      className="h-4 w-4 accent-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-slate-500">금액 입력 단위는 만원이며, 모바일에서는 표 영역 내부만 가로 스크롤됩니다.</p>
    </section>
  );
}
