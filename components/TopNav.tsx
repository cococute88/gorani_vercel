"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { NAV_ITEMS } from "@/lib/mockData";
import LoginButton from "@/components/auth/LoginButton";

const MOBILE_PRIMARY_COUNT = 2;
const DESKTOP_INITIAL_VISIBLE_COUNT = 2;
const DESKTOP_NAV_GAP_PX = 4;

type Props = {
  theme?: "dark" | "light";
};

// 상단 네비게이션. 모바일은 주요 칩 + 더보기 패널, 데스크톱은 전체 가로 메뉴를 보여준다.
export default function TopNav({ theme = "dark" }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [desktopVisibleCount, setDesktopVisibleCount] = useState(
    DESKTOP_INITIAL_VISIBLE_COUNT,
  );
  const desktopNavRef = useRef<HTMLElement | null>(null);
  const itemMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const nav = desktopNavRef.current;
    if (!nav) return;

    const measure = () => {
      const itemWidths = NAV_ITEMS.map(
        (_, index) => itemMeasureRefs.current[index]?.offsetWidth ?? 0,
      );
      const moreWidth = moreMeasureRef.current?.offsetWidth ?? 0;
      const availableWidth = nav.clientWidth;

      if (!availableWidth || itemWidths.some((width) => width === 0) || !moreWidth) {
        return;
      }

      const totalItems = NAV_ITEMS.length;
      let nextVisibleCount = 0;

      for (let count = totalItems; count >= 0; count -= 1) {
        const visibleWidth = itemWidths
          .slice(0, count)
          .reduce((sum, width) => sum + width, 0);
        const visibleGaps = Math.max(count - 1, 0) * DESKTOP_NAV_GAP_PX;
        const hasHiddenItems = count < totalItems;
        const moreGap = hasHiddenItems && count > 0 ? DESKTOP_NAV_GAP_PX : 0;
        const requiredWidth =
          visibleWidth + visibleGaps + (hasHiddenItems ? moreWidth + moreGap : 0);

        if (requiredWidth <= availableWidth) {
          nextVisibleCount = count;
          break;
        }
      }

      setDesktopVisibleCount((current) =>
        current === nextVisibleCount ? current : nextVisibleCount,
      );
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(nav);

    document.fonts?.ready.then(measure).catch(() => undefined);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const isLight = theme === "light";
  const barBg = isLight ? "bg-[#0f1729]" : "bg-[#0c1011]";
  const border = isLight ? "border-[#1e293b]" : "border-[#1c2426]";
  const mobilePrimaryItems = NAV_ITEMS.slice(0, MOBILE_PRIMARY_COUNT);
  const mobileHiddenItems = NAV_ITEMS.slice(MOBILE_PRIMARY_COUNT);
  const desktopVisibleItems = NAV_ITEMS.slice(0, desktopVisibleCount);
  const desktopHiddenItems = NAV_ITEMS.slice(desktopVisibleCount);

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

  const moreButtonClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors md:rounded-md ${
      active
        ? "border-blue-400/50 bg-blue-600 text-white"
        : "border-blue-500/30 bg-blue-600/15 text-blue-200 hover:bg-blue-600/25"
    }`;

  return (
    <header className={`sticky top-0 z-50 w-full overflow-x-hidden ${barBg} border-b ${border}`}>
      <div className="mx-auto flex w-full max-w-[1640px] min-w-0 flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-5 md:h-14 md:flex-nowrap md:py-0">
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
        <nav
          ref={desktopNavRef}
          className="order-2 relative hidden min-w-0 flex-1 items-center gap-1 overflow-hidden md:flex"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 flex h-0 gap-1 overflow-hidden opacity-0"
          >
            {NAV_ITEMS.map((item, index) => {
              const active = isActive(item.href);
              return (
                <span
                  key={item.label}
                  ref={(node) => {
                    itemMeasureRefs.current[index] = node;
                  }}
                  className={linkClass(active)}
                >
                  <span className="text-[13px] leading-none">{item.icon}</span>
                  <span className="whitespace-nowrap">{item.label}</span>
                </span>
              );
            })}
            <span ref={moreMeasureRef} className={moreButtonClass(false)}>
              ☰ 더보기
            </span>
          </div>

          {desktopVisibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href} className={linkClass(active)}>
                <span className="text-[13px] leading-none">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
          {desktopHiddenItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className={moreButtonClass(desktopHiddenItems.some((item) => isActive(item.href)))}
            >
              ☰ 더보기
            </button>
          )}
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
            className={moreButtonClass(mobileHiddenItems.some((item) => isActive(item.href)))}
          >
            ☰ 더보기
          </button>
        </nav>
      </div>

      {menuOpen && (
        <div className="border-t border-white/10 px-3 pb-3 md:hidden">
          <div className="mx-auto grid w-full max-w-[1640px] grid-cols-2 gap-1.5 rounded-2xl border border-[#22303a] bg-[#101719] p-2 shadow-2xl">
            {mobileHiddenItems.map((item) => {
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

      {menuOpen && desktopHiddenItems.length > 0 && (
        <div className="hidden border-t border-white/10 px-5 pb-3 md:block">
          <div className="mx-auto grid w-full max-w-[1640px] grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-1.5 rounded-xl border border-[#22303a] bg-[#101719] p-2 shadow-2xl">
            {desktopHiddenItems.map((item) => {
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
