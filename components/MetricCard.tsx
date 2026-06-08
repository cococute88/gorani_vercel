import { ReactNode } from "react";

type Tone = "gray" | "green" | "orange" | "blue";

const TONE_DARK: Record<Tone, string> = {
  gray: "bg-[#202627] border-[#2a3336]",
  green: "bg-[#16241c] border-[#244233]",
  orange: "bg-[#27201a] border-[#43331f]",
  blue: "bg-[#16202e] border-[#23364f]",
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
    <div className={`rounded-xl border px-5 py-4 ${TONE_DARK[tone]}`}>
      <div className="text-[12.5px] font-medium text-slate-400">{label}</div>
      <div
        className="num mt-2 text-[22px] font-extrabold leading-tight text-slate-100"
        style={valueColor ? { color: valueColor } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-slate-500">{sub}</div>}
    </div>
  );
}
