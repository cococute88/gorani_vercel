"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { NAV_ITEMS } from "@/lib/mockData";
import LoginButton from "@/components/auth/LoginButton";

const MOBILE_PRIMARY_COUNT = 2;

type Props = {
  theme?: "dark" | "light";
};

// 상단 네비게이션. 모바일은 주요 칩 + 더보기 패널, 데스크톱은 전체 가로 메뉴를 보여준다.
export default function TopNav({ theme = "dark" }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isLight = theme === "light";
  const barBg = isLight ? "bg-[#0f1729]" : "bg-[#0c1011]";
  const border = isLight ? "border-[#1e293b]" : "border-[#1c2426]";
  const mobilePrimaryItems = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);

  const isActive = (href: string) =>
    href !== "#" &&
    (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const linkClass = (active: boolean, mobilePanel = false) =>
    `flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium transition-colors ${
      mobilePanel ? "px-3 py-2" : "px-2.5 py-1.5"
    } ${
      active
        ? "bg-blue-600 text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  return (
    <header className={`sticky top-0 z-50 w-full overflow-x-hidden ${barBg} border-b ${border}`}>
      <div className="mx-auto flex w-full max-w-[1640px] flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-5 md:h-14 md:flex-nowrap md:py-0">
        {/* 로고 */}
        <Link
          href="/portfolio"
          className="order-1 mr-auto flex shrink-0 items-center gap-1.5 md:mr-3"
        >
          <Image
            src="/gorani-logo.png"
            alt="GORANI logo"
            width={28}
            height={28}
            className="h-7 w-7 rounded-full object-contain"
          />
          <span className="text-[17px] font-extrabold tracking-tight text-white">
            GORAFI
          </span>
        </Link>

        {/* 데스크톱 메뉴 */}
        <nav className="no-scrollbar order-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href} className={linkClass(active)}>
                <span className="text-[13px] leading-none">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* 우측 */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 md:order-3 md:ml-2 md:gap-2">
          <LoginButton />
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
        </div>

        {/* 모바일 주요 메뉴 + 더보기 */}
        <nav className="order-3 grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 md:hidden">
          <div className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto">
            {mobilePrimaryItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span className="text-[13px] leading-none">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            className="shrink-0 rounded-full border border-blue-500/30 bg-blue-600/15 px-3 py-1.5 text-[13px] font-semibold text-blue-200 hover:bg-blue-600/25"
          >
            ☰ 더보기
          </button>
        </nav>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 px-3 pb-3 md:hidden">
          <div className="mx-auto grid w-full max-w-[1640px] grid-cols-2 gap-1.5 rounded-2xl border border-[#22303a] bg-[#101719] p-2 shadow-2xl">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={linkClass(active, true)}
                >
                  <span className="text-[14px] leading-none">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
