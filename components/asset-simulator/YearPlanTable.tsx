import type { YearPlanRow } from "@/lib/asset-simulator-types";

const MONEY_FIELDS: Array<{ key: keyof YearPlanRow; label: string }> = [
  { key: "monthlyContribution", label: "월 적립액" },
  { key: "isaContribution", label: "ISA 적립" },
  { key: "pensionContribution", label: "연금저축 적립" },
  { key: "taxableContribution", label: "위탁 적립" },
  { key: "isaToPensionTransfer", label: "ISA → 연금 이전" },
];

type Props = {
  plans: YearPlanRow[];
  onChange: (plans: YearPlanRow[]) => void;
};

export default function YearPlanTable({ plans, onChange }: Props) {
  const updatePlan = (index: number, key: keyof YearPlanRow, rawValue: string) => {
    const nextPlans = plans.map((plan, planIndex) => {
      if (planIndex !== index) return plan;
      if (key === "note") return { ...plan, note: rawValue };
      const parsed = Number(rawValue);
      return { ...plan, [key]: Number.isFinite(parsed) ? parsed * 10000 : 0 };
    });
    onChange(nextPlans);
  };

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4">
        <h2 className="text-base font-extrabold text-white">연도별 계획표</h2>
        <p className="mt-1 text-[13px] text-slate-400">초기 8년 월 300만원 적립 이후 은퇴/인출 단계를 preview로 표시합니다.</p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#263033]">
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-3 text-left">연도</th>
              {MONEY_FIELDS.map((field) => (
                <th key={field.key} className="px-3 py-3 text-right">{field.label}</th>
              ))}
              <th className="px-3 py-3 text-left">비고</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan, index) => (
              <tr key={plan.year} className="border-t border-[#263033] text-slate-200 odd:bg-white/[0.015]">
                <td className="px-3 py-2 font-bold text-slate-100">{plan.year}</td>
                {MONEY_FIELDS.map((field) => (
                  <td key={field.key} className="px-3 py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step={10}
                      value={Math.round(Number(plan[field.key]) / 10000)}
                      onChange={(event) => updatePlan(index, field.key, event.target.value)}
                      className="num w-28 rounded-lg border border-[#303a3d] bg-[#0c1011] px-2 py-1.5 text-right text-[13px] font-semibold text-white outline-none focus:border-blue-500"
                    />
                  </td>
                ))}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={plan.note}
                    onChange={(event) => updatePlan(index, "note", event.target.value)}
                    className="w-48 rounded-lg border border-[#303a3d] bg-[#0c1011] px-2 py-1.5 text-[13px] text-white outline-none focus:border-blue-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-slate-500">금액 입력 단위는 만원이며, 표 영역 내부만 가로 스크롤됩니다.</p>
    </section>
  );
}
