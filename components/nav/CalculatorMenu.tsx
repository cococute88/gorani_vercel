"use client";

import { useRef } from "react";
import Link from "next/link";
import { useAnchoredMenu } from "./useAnchoredMenu";

// 계산기 하위 메뉴. URL 은 /calculator?tab=... 로 이동하고 CalculatorPage 가
// searchParams 를 읽어 해당 탭을 연다.
const CALC_SUBITEMS = [
  { label: "배당치기", tab: "dividend-capture" },
  { label: "매도전환", tab: "conversion" },
  { label: "MDD", tab: "mdd" },
] as const;

type Props = {
  isLight: boolean;
  icon: string;
  label: string;
  triggerClass: string;
};

export default function CalculatorMenu({ isLight, icon, label, triggerClass }: Props) {
  const { open, setOpen, coords, triggerRef, menuRef } = useAnchoredMenu("left", 188);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // hover 가 풀릴 때 너무 빨리 닫히지 않도록 약간의 지연을 둔다.
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 140);
  };

  const itemClass = (isActive: boolean) =>
    `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
      isActive
        ? "bg-blue-600 text-white"
        : isLight
          ? "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
          : "text-slate-300 hover:bg-blue-500/15 hover:text-white"
    }`;

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onFocus={() => setOpen(true)}
        className={triggerClass}
      >
        <span className="text-[13px] leading-none">{icon}</span>
        <span className="whitespace-nowrap">{label}</span>
        <span aria-hidden className="text-[10px] leading-none opacity-70">▾</span>
      </button>

      {open && coords && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="계산기 하위 메뉴"
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }}
          className={`z-[60] flex flex-col gap-0.5 rounded-xl border p-1.5 shadow-2xl ${
            isLight ? "border-slate-200 bg-white" : "border-[#22303a] bg-[#101719]"
          }`}
        >
          {CALC_SUBITEMS.map((item) => (
            <Link
              key={item.tab}
              role="menuitem"
              href={`/calculator?tab=${item.tab}`}
              onClick={() => setOpen(false)}
              className={itemClass(false)}
            >
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
