"use client";

import { useMemo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import TableCsvMenu from "@/components/ui/TableCsvMenu";
import type { YearPlanRow } from "@/lib/asset-simulator-types";

type Props = {
  plans: YearPlanRow[];
  onChange: (plans: YearPlanRow[]) => void;
  // 계획표 펼침/접힘 상태. 미지정 시 항상 펼침(기존 동작 유지).
  open?: boolean;
  onToggleOpen?: () => void;
  // EXIT 모드에서는 계획표가 계산에 사용되지 않음을 안내한다.
  exitMode?: boolean;
};

// 체크박스 3종을 표/카드 양쪽에서 공유한다. (모바일 카드는 짧은 라벨, sm+ 표는 전체 라벨)
const CHECKBOX_FIELDS: Array<{ key: keyof Pick<YearPlanRow, "isaContribution" | "pensionContribution" | "isaToPensionTransfer">; label: string; short: string }> = [
  { key: "isaContribution", label: "ISA적립", short: "ISA" },
  { key: "pensionContribution", label: "연금저축적립", short: "연금저축" },
  { key: "isaToPensionTransfer", label: "ISA연금이전", short: "연금이전" },
];

export default function YearPlanTable({ plans, onChange, open = true, onToggleOpen, exitMode = false }: Props) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const collapsible = typeof onToggleOpen === "function";
  const bodyVisible = !collapsible || open;
  const updatePlan = (index: number, patch: Partial<YearPlanRow>) => {
    onChange(plans.map((plan, planIndex) => (planIndex === index ? { ...plan, ...patch } : plan)));
  };

  const setMonthly = (index: number, raw: string) =>
    updatePlan(index, { monthlyContribution: Math.max(0, Number(raw) || 0) });

  return (
    <section className="rounded-2xl border border-[#273032] bg-[#171d1e] p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-white">연도별 투자 계획표</h2>
        <p className="mt-1 break-keep text-[13px] text-slate-400">기본 계획은 원본처럼 초기 8년 월 300만원 적립입니다. 체크 여부와 월적립액을 바꾸면 즉시 재계산됩니다.</p>
        {exitMode ? (
          <p className="mt-1 break-keep text-[12px] font-semibold text-cyan-300">지금 EXIT? 모드에서는 이 계획표가 계산에 사용되지 않습니다.</p>
        ) : null}
        </div>
        {/* CSV 버튼은 항상 접근 가능. 그 왼쪽에 계획표 접기/펼치기 토글을 둔다. */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={onToggleOpen}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#303a3d] px-3 py-2 text-[13px] font-bold text-slate-200 transition-colors hover:bg-white/5"
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {open ? "계획표 접기" : "계획표 펼치기"}
            </button>
          ) : null}
          <TableCsvMenu filename={`asset-simulator-year-plan-${today}.csv`} rows={plans} columns={[
            { header: "년도", value: (row) => row.year },
            { header: "월적립액(만원)", value: (row) => row.monthlyContribution },
            { header: "ISA적립", value: (row) => row.isaContribution ? "예" : "아니오" },
            { header: "연금저축적립", value: (row) => row.pensionContribution ? "예" : "아니오" },
            { header: "ISA연금이전", value: (row) => row.isaToPensionTransfer ? "예" : "아니오" },
          ]} />
        </div>
      </div>

      {bodyVisible ? (
      <>
      {/* 모바일: 연도별 카드 (가로 스크롤 없이 카드 안에 모두 표시).
          연차가 많으면(기본 30년) 카드 영역 안에서만 세로 스크롤하여 페이지가 과도하게 늘어나지 않게 한다. */}
      <div className="-mr-1 max-h-[60vh] space-y-2 overflow-y-auto pr-1 sm:hidden">
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

      {/* sm+ : 기존 표 레이아웃.
          약 10개 본문 행 + 헤더 높이로 max-height 를 제한하고, 넘치는 연차는 컨테이너 내부에서만 세로 스크롤한다.
          헤더는 sticky 로 고정해 스크롤 중에도 읽힌다. (네이티브 스크롤바는 color-scheme 를 따라 라이트/다크 자동 대응) */}
      <div className="hidden max-h-[556px] overflow-auto rounded-xl border border-[#263033] sm:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-[#111516] text-[12px] uppercase tracking-wide text-slate-400 shadow-[0_1px_0_0_rgba(0,0,0,0.25)]">
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
      </>
      ) : (
        <p className="break-keep text-[13px] text-slate-500">계획표가 접혀 있습니다. 위의 “계획표 펼치기” 버튼으로 다시 열 수 있습니다.</p>
      )}
    </section>
  );
}
