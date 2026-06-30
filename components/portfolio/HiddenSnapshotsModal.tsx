"use client";

import { useEffect, useRef } from "react";
import { RotateCcw, EyeOff } from "lucide-react";
import { formatWon, formatPercent } from "@/lib/format";

// 숨긴 스냅샷 1행에 필요한 표시 데이터.
// snapshotDate 만 복구 키로 쓰고, 나머지는 메인 히스토리와 동일 형식으로 표시한다.
// 데이터가 비어 있는(다른 소스에서 일시적으로 못 불러온) 숨김 날짜도 날짜만으로 행을
// 표시할 수 있도록 금액 필드는 null 을 허용한다.
export interface HiddenSnapshotRow {
  snapshotDate: string;
  totalAssetKRW: number | null;
  investmentValueKRW: number | null;
  investmentPrincipalKRW: number | null;
  returnPct: number | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  rows: HiddenSnapshotRow[];
  onRestore: (snapshotDate: string) => void;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function cell(value: number | null, formatter: (value: number) => string): string {
  return value == null ? "-" : formatter(value);
}

// 숨긴 스냅샷 조회/복구 모달.
// - 표시 항목: 날짜 / 총자산 / 투자 평가금액 / 투자원금 / 수익률 / 복구
// - 메인 히스토리(SnapshotHistory)와 동일한 다크 카드/표 스타일을 사용해 자연스럽게 어울리게 한다.
// - 복구는 snapshotDate 기준으로 상위(PortfolioPage)에 위임한다(로컬 + Firestore 동기화).
export default function HiddenSnapshotsModal({ open, onClose, rows, onRestore }: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // ESC 닫기 + 포커스 트랩 + 포커스 복원 + 배경 스크롤 잠금 (ExitSummaryModal 과 동일 패턴).
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
        aria-labelledby="hidden-snapshots-title"
        tabIndex={-1}
        className="relative z-[1] flex max-h-[85vh] w-full max-w-[760px] flex-col overflow-hidden rounded-3xl border border-[#273032] bg-[#171d1e] shadow-2xl outline-none"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <h2 id="hidden-snapshots-title" className="flex items-center gap-2 text-[18px] font-extrabold text-white">
              <EyeOff size={18} className="text-amber-400" />
              숨긴 스냅샷
            </h2>
            <p className="mt-1 break-keep text-[12px] text-slate-400">
              숨김은 삭제가 아닙니다. 복구하면 등록된 스냅샷 히스토리에 다시 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="scroll-dark mt-3 overflow-auto px-5 pb-5">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#2a3336] py-12 text-center">
              <EyeOff size={22} className="text-slate-500" />
              <p className="text-[13px] text-slate-400">숨긴 스냅샷이 없습니다.</p>
              <p className="text-[12px] text-slate-500">히스토리에서 숨기기를 누르면 여기로 이동합니다.</p>
            </div>
          ) : (
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-[#2a3336] text-left text-slate-400">
                  <th className="px-3 py-2 font-medium">날짜</th>
                  <th className="px-3 py-2 text-right font-medium">총자산</th>
                  <th className="px-3 py-2 text-right font-medium">투자 평가금액</th>
                  <th className="px-3 py-2 text-right font-medium">투자원금</th>
                  <th className="px-3 py-2 text-right font-medium">수익률</th>
                  <th className="px-3 py-2 text-right font-medium">복구</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.snapshotDate} className="border-b border-[#1c2426] hover:bg-white/[0.02]">
                    <td className="num px-3 py-2.5 font-semibold text-white">{row.snapshotDate}</td>
                    <td className="num px-3 py-2.5 text-right text-slate-200">{cell(row.totalAssetKRW, formatWon)}</td>
                    <td className="num px-3 py-2.5 text-right text-slate-200">{cell(row.investmentValueKRW, formatWon)}</td>
                    <td className="num px-3 py-2.5 text-right text-slate-300">{cell(row.investmentPrincipalKRW, formatWon)}</td>
                    <td
                      className={`num px-3 py-2.5 text-right ${
                        row.returnPct == null ? "text-slate-400" : row.returnPct >= 0 ? "text-red-400" : "text-blue-400"
                      }`}
                    >
                      {row.returnPct == null ? "-" : formatPercent(row.returnPct, 1)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => onRestore(row.snapshotDate)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[12px] font-semibold text-emerald-300 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/20 hover:text-emerald-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                          title="이 스냅샷을 복구합니다"
                          aria-label={`${row.snapshotDate} 스냅샷 복구`}
                        >
                          <RotateCcw size={13} />
                          복구
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
