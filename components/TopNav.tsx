"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { NAV_ITEMS } from "@/lib/mockData";
import LoginButton from "@/components/auth/LoginButton";

// Safe initial count: always small enough to never overflow on first paint,
// the ResizeObserver expands it on mount.
const INITIAL_VISIBLE_COUNT = 2;
const NAV_GAP_PX = 4; // matches the `gap-1` on the nav row

type Props = {
  theme?: "dark" | "light";
};

// 상단 네비게이션. 단일 measured priority nav 으로 동작한다.
// - 좁은 폭: 1행(로고 + 우측 컨트롤), 2행(네비 전체 폭)의 2행 레이아웃.
// - 넓은 폭(lg 이상): 로고 | 네비 | 우측 컨트롤의 1행 레이아웃.
// 두 경우 모두 들어갈 수 있는 만큼 항목을 노출하고, 숨겨진 항목이 있으면 더보기를 우측에 고정한다.
export default function TopNav({ theme = "dark" }: Props) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);
  const navRef = useRef<HTMLElement | null>(null);
  const itemMeasureRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const moreMeasureRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    const nav = navRef.current;
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
        const visibleGaps = Math.max(count - 1, 0) * NAV_GAP_PX;
        const hasHiddenItems = count < totalItems;
        const moreGap = hasHiddenItems && count > 0 ? NAV_GAP_PX : 0;
        const requiredWidth =
          visibleWidth + visibleGaps + (hasHiddenItems ? moreWidth + moreGap : 0);

        if (requiredWidth <= availableWidth) {
          nextVisibleCount = count;
          break;
        }
      }

      setVisibleCount((current) =>
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
  const visibleItems = NAV_ITEMS.slice(0, visibleCount);
  const hiddenItems = NAV_ITEMS.slice(visibleCount);

  const isActive = (href: string) =>
    href !== "#" &&
    (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

  const linkClass = (active: boolean, panel = false) =>
    `flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium transition-colors ${
      panel ? "px-3 py-2" : "px-2.5 py-1.5"
    } ${
      active
        ? "bg-blue-600 text-white"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`;

  const moreButtonClass = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors lg:rounded-md ${
      active
        ? "border-blue-400/50 bg-blue-600 text-white"
        : "border-blue-500/30 bg-blue-600/15 text-blue-200 hover:bg-blue-600/25"
    }`;

  return (
    <header className={`sticky top-0 z-50 w-full overflow-x-hidden ${barBg} border-b ${border}`}>
      <div className="mx-auto flex w-full max-w-[1640px] min-w-0 flex-wrap items-center gap-x-2 gap-y-2 px-3 py-2 sm:px-5 lg:h-14 lg:flex-nowrap lg:py-0">
        {/* 로고 (1행 좌측) */}
        <Link
          href="/portfolio"
          className="order-1 flex shrink-0 items-center gap-1.5 lg:mr-3"
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

        {/* 우측 컨트롤 (좁은 폭: 1행 우측 / lg: 행 끝) */}
        <div className="order-2 ml-auto flex shrink-0 items-center gap-1.5 lg:order-3 lg:ml-2 lg:gap-2">
          <LoginButton />
          <button className="relative flex h-8 w-8 items-center justify-center rounded-md text-slate-300 hover:bg-white/10">
            <Bell size={15} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
          </button>
        </div>

        {/* 네비게이션 (좁은 폭: 2행 전체 폭 / lg: 1행 가운데 flex-1) */}
        <nav
          ref={navRef}
          className="order-3 relative flex w-full min-w-0 items-center gap-1 overflow-hidden lg:order-2 lg:w-auto lg:flex-1"
        >
          {/* 폭 측정용(보이지 않음). 실제 렌더 항목과 동일 구조여야 정확하게 측정된다. */}
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

          {visibleItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.label} href={item.href} className={linkClass(active)}>
                <span className="text-[13px] leading-none">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
          {hiddenItems.length > 0 && (
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              className={`ml-auto ${moreButtonClass(hiddenItems.some((item) => isActive(item.href)))}`}
            >
              ☰ 더보기
            </button>
          )}
        </nav>
      </div>

      {/* 더보기 패널: 숨겨진 항목 노출 */}
      {menuOpen && hiddenItems.length > 0 && (
        <div className="border-t border-white/10 px-3 pb-3 sm:px-5">
          <div className="mx-auto grid w-full max-w-[1640px] grid-cols-2 gap-1.5 rounded-2xl border border-[#22303a] bg-[#101719] p-2 shadow-2xl sm:grid-cols-[repeat(auto-fit,minmax(150px,1fr))]">
            {hiddenItems.map((item) => {
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
