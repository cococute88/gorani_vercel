"use client";

import type { ReactNode } from "react";

// PORTFOLIO-CALCULATOR-UX-FIX-2 #5: 금액 표시 공통 컴포넌트.
// 원화 기호와 숫자가 절대 줄바꿈으로 분리되지 않도록 nowrap + tabular-nums 를 보장하고,
// 카드 폭이 좁을 때는 폰트를 자동 축소(clamp)해 가로 overflow 를 막는다.
type Props = {
  children: ReactNode;
  className?: string;
  // true 면 큰 KPI 숫자에 반응형 clamp 폰트를 적용한다.
  shrink?: boolean;
  title?: string;
};

export default function MoneyText({ children, className = "", shrink = false, title }: Props) {
  const shrinkCls = shrink ? "text-[clamp(0.95rem,5.2vw,1.375rem)]" : "";
  return (
    <span
      className={`num inline-block max-w-full whitespace-nowrap tabular-nums ${shrinkCls} ${className}`}
      title={title}
    >
      {children}
    </span>
  );
}
