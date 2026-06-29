"use client";

// =============================================================
// TR(배당 포함) / PR(배당 제외) 세그먼트 토글.
//
// 시장현황 "수익률 비교" 와 계산기 "성과 비교" 그래프에서 공유하여 동일한 UX 를
// 유지한다. 디자인은 기간 버튼 그룹과 자연스럽게 어울리도록 동일한 둥근 컨테이너
// + 활성 세그먼트 강조 방식을 사용한다.
//
//  - TR(Total Return): 배당 재투자(조정종가) 기준.
//  - PR(Price Return):  배당 제외(종가) 기준.
// 기본값은 호출부에서 TR 로 설정한다(여기서는 표시만 담당).
// =============================================================

export type TrPrMode = "tr" | "pr";

interface Props {
  mode: TrPrMode;
  onChange: (mode: TrPrMode) => void;
  /** 컴팩트(상세 모달 등) 여부. 폰트/패딩을 약간 줄인다. */
  size?: "md" | "sm";
  disabled?: boolean;
  className?: string;
}

const SEGMENTS: ReadonlyArray<{ key: TrPrMode; label: string; title: string }> = [
  { key: "tr", label: "TR", title: "Total Return · 배당 포함(재투자)" },
  { key: "pr", label: "PR", title: "Price Return · 배당 제외" },
];

export default function TrPrToggle({ mode, onChange, size = "md", disabled, className }: Props) {
  const pad = size === "sm" ? "px-2 py-1 text-[11.5px]" : "px-2.5 py-1 text-[12px]";
  return (
    <div
      role="radiogroup"
      aria-label="수익률 기준(TR/PR)"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700/60 dark:bg-[#111516] ${className ?? ""}`}
    >
      {SEGMENTS.map((seg) => {
        const active = mode === seg.key;
        return (
          <button
            key={seg.key}
            type="button"
            role="radio"
            aria-checked={active}
            title={seg.title}
            disabled={disabled}
            onClick={() => onChange(seg.key)}
            className={`shrink-0 rounded-md font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${pad} ${
              active
                ? "bg-blue-600 text-white"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
