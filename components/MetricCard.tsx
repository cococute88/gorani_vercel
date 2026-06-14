import { ReactNode } from "react";

type Tone = "gray" | "green" | "orange" | "blue";

// Light surface first, dark variant second so the card themes with the page.
const TONE: Record<Tone, string> = {
  gray: "bg-white border-slate-200 dark:bg-[#202627] dark:border-[#2a3336]",
  green: "bg-emerald-50 border-emerald-200 dark:bg-[#16241c] dark:border-[#244233]",
  orange: "bg-amber-50 border-amber-200 dark:bg-[#27201a] dark:border-[#43331f]",
  blue: "bg-blue-50 border-blue-200 dark:bg-[#16202e] dark:border-[#23364f]",
};

type Props = {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  valueColor?: string;
  children?: ReactNode;
};

// 투자 성과 페이지 상단 KPI 카드 (다크).
export default function MetricCard({
  label,
  value,
  sub,
  tone = "gray",
  valueColor,
}: Props) {
  return (
    <div className={`min-w-0 rounded-xl border px-4 py-4 sm:px-5 ${TONE[tone]}`}>
      <div className="break-keep text-[12.5px] font-medium text-slate-500 dark:text-slate-400">{label}</div>
      <div
        className="num mt-2 break-keep text-[18px] font-extrabold leading-tight text-slate-900 dark:text-slate-100 sm:text-[22px]"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 break-keep text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}
