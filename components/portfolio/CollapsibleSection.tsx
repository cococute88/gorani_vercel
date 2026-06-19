"use client";

import { useState, type ReactNode } from "react";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

// 접기/펼치기 섹션. 헤더 클릭 시 ▶/▼ 토글로 내용을 표시/숨김.
export default function CollapsibleSection({ title, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-[#2a3336] bg-[#191f20]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-2xl px-5 py-4 text-left hover:bg-white/[0.02]"
      >
        <span className="shrink-0 text-[12px] text-slate-400">{open ? "▼" : "▶"}</span>
        <span className="text-[15px] font-bold text-slate-300">{title}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}
