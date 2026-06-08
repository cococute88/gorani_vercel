"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Lock, Bell } from "lucide-react";
import { NAV_ITEMS } from "@/lib/mockData";

type Props = {
  theme?: "dark" | "light";
};

// 상단 네비게이션. 다크/라이트 테마를 모두 지원하고 현재 경로를 active 처리한다.
export default function TopNav({ theme = "dark" }: Props) {
  const pathname = usePathname();

  const isLight = theme === "light";
  const barBg = isLight ? "bg-[#0f1729]" : "bg-[#0c1011]";
  const border = isLight ? "border-[#1e293b]" : "border-[#1c2426]";

  return (
    <header className={`sticky top-0 z-50 w-full ${barBg} border-b ${border}`}>
      <div className="flex h-14 items-center gap-1 px-5">
                {/* 로고 */}
        <Link
          href="/qld-dashboard"
          className="mr-3 flex items-center gap-1.5 shrink-0"
        >
          <Image
            src="/gorani-logo.png"
            alt="GORANI logo"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-contain"
          />
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            GORANI
          </span>
        </Link>

        {/* 메뉴 */}
        <nav className="no-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href !== "#" &&
              (item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-[13px] leading-none">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 우측 */}
        <div className="ml-2 flex shrink-0 items-center gap-2">
          <button className="flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <Lock size={15} />
          </button>
          <button className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20">
            관리
          </button>
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
        </div>
      </div>
    </header>
  );
}
