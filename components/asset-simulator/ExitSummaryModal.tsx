"use client";

import { useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import type { SimulatorInputs, SimulatorProjection } from "@/lib/asset-simulator-types";
import { buildExitSummary, toManwon } from "@/lib/asset-simulator-exit-summary";

type Props = {
  open: boolean;
  onClose: () => void;
  projection: SimulatorProjection;
  inputs: SimulatorInputs;
};

type CardTone = "green" | "orange" | "blue" | "purple";

const TONE: Record<CardTone, { surface: string; value: string; chip: string }> = {
  green: {
    surface: "bg-emerald-50 border-emerald-200 dark:bg-[#16241c] dark:border-[#244233]",
    value: "text-emerald-600 dark:text-emerald-300",
    chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  orange: {
    surface: "bg-amber-50 border-amber-200 dark:bg-[#27201a] dark:border-[#43331f]",
    value: "text-amber-600 dark:text-amber-300",
    chip: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  },
  blue: {
    surface: "bg-blue-50 border-blue-200 dark:bg-[#16202e] dark:border-[#23364f]",
    value: "text-blue-600 dark:text-blue-300",
    chip: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  },
  purple: {
    surface: "bg-violet-50 border-violet-200 dark:bg-[#201a2e] dark:border-[#352a52]",
    value: "text-violet-600 dark:text-violet-300",
    chip: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  },
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function SummaryCard({
  tone,
  title,
  prefix,
  amount,
  unit,
  desc,
}: {
  tone: CardTone;
  title: string;
  prefix?: string;
  amount: number;
  unit: string;
  desc: string;
}) {
  const styles = TONE[tone];
  return (
    <div className={`flex min-w-0 flex-col rounded-2xl border px-4 py-4 ${styles.surface}`}>
      <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[12px] font-bold ${styles.chip}`}>
        {title}
      </span>
      <div className="mt-3 flex items-baseline gap-1">
        {prefix && <span className={`text-[16px] font-extrabold leading-none sm:text-[18px] ${styles.value}`}>{prefix}</span>}
        <span className={`num min-w-0 truncate text-[28px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[36px] ${styles.value}`}>
          {amount.toLocaleString("ko-KR")}
        </span>
        <span className={`shrink-0 text-[15px] font-bold ${styles.value}`}>{unit}</span>
      </div>
      <p className="mt-2 break-keep text-[12px] leading-4 text-slate-500 dark:text-slate-400">{desc}</p>
    </div>
  );
}

export default function ExitSummaryModal({ open, onClose, projection, inputs }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const summary = useMemo(
    () => buildExitSummary(projection, inputs),
    [projection, inputs],
  );

  // ESC 닫기 + 포커스 트랩 + 포커스 복원 + 배경 스크롤 잠금.
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = (document.activeElement as HTMLElement) ?? null;

    const dialog = dialogRef.current;
    const focusables = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusables && focusables.length > 0 ? focusables[0] : dialog)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const nodes = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (node) => node.offsetParent !== null || node === document.activeElement,
      );
      if (nodes.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocusedRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exit-summary-title"
        tabIndex={-1}
        className="relative z-[1] flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl outline-none dark:border-[#273032] dark:bg-[#171d1e]"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <h2 id="exit-summary-title" className="text-[20px] font-extrabold text-slate-900 dark:text-white">
            🚪 당장탈출
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          <div className="mt-3 overflow-hidden rounded-2xl bg-slate-100 dark:bg-black/20">
            <Image
              src="/bye.webp"
              alt="당장탈출"
              width={1234}
              height={621}
              sizes="(max-width: 560px) 92vw, 520px"
              className="h-auto w-full object-contain"
              priority
            />
          </div>

          <p className="mt-3 break-keep text-center text-[13px] text-slate-500 dark:text-slate-400">
            지금 설정 기준으로 퇴사하면 매달 이만큼 받을 수 있어요.
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <SummaryCard
              tone="green"
              title="위탁 배당"
              amount={toManwon(summary.brokerageMonthlyReal)}
              unit="만"
              desc="세후·실질가치 월 배당"
            />
            <SummaryCard
              tone="orange"
              title="절세 인출"
              amount={toManwon(summary.taxSavingMonthlyReal)}
              unit="만"
              desc="세후·실질가치 월 인출"
            />
            <SummaryCard
              tone="blue"
              title="1년 더 근무"
              prefix="+"
              amount={toManwon(summary.oneMoreYearMonthlyDeltaNominal)}
              unit="만"
              desc={
                summary.oneMoreYearContributionYear
                  ? `${summary.oneMoreYearContributionYear}년 월 ${summary.oneMoreYearMonthlyContribution}만 추가 적립 · 명목가치`
                  : "명목가치 기준 증가분"
              }
            />
            <SummaryCard
              tone="purple"
              title="55세 이후"
              amount={toManwon(summary.afterFiftyFiveMonthlyReal)}
              unit="만"
              desc="현재가치 월 인출 (과세 반영)"
            />
          </div>

          <p className="mt-3 break-keep text-center text-[11px] leading-4 text-slate-400 dark:text-slate-500">
            모든 금액은 만원 단위이며, 현재 화면의 최신 계산 결과를 그대로 사용합니다.
          </p>
        </div>
      </div>
    </div>
  );
}
