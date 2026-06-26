"use client";

import { useRef } from "react";
import Link from "next/link";
import { useAnchoredMenu } from "./useAnchoredMenu";

const DIVIDEND_SUBITEMS = [
  { label: "배당현황", tab: "overview" },
  { label: "SCHD 매력도", tab: "schd-attractiveness" },
] as const;

type Props = {
  isLight: boolean;
  icon: string;
  label: string;
  triggerClass: string;
};

export default function DividendMenu({ isLight, icon, label, triggerClass }: Props) {
  const { open, setOpen, coords, triggerRef, menuRef } = useAnchoredMenu("left", 188);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const itemClass = `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
    isLight
      ? "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
      : "text-slate-300 hover:bg-blue-500/15 hover:text-white"
  }`;

  return (
    <div className="relative shrink-0" onMouseEnter={() => { cancelClose(); setOpen(true); }} onMouseLeave={scheduleClose}>
      <button ref={triggerRef} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} onFocus={() => setOpen(true)} className={triggerClass}>
        <span className="text-[13px] leading-none">{icon}</span>
        <span className="whitespace-nowrap">{label}</span>
        <span aria-hidden className="text-[10px] leading-none opacity-70">▾</span>
      </button>
      {open && coords && (
        <div ref={menuRef} role="menu" aria-label="배당 하위 메뉴" onMouseEnter={cancelClose} onMouseLeave={scheduleClose} style={{ position: "fixed", top: coords.top, left: coords.left, width: coords.width }} className={`z-[60] flex flex-col gap-0.5 rounded-xl border p-1.5 shadow-2xl ${isLight ? "border-slate-200 bg-white" : "border-[#22303a] bg-[#101719]"}`}>
          {DIVIDEND_SUBITEMS.map((item) => (
            <Link key={item.tab} role="menuitem" href={`/dividends?tab=${item.tab}`} onClick={() => setOpen(false)} className={itemClass}>
              <span className="truncate">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
