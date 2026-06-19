"use client";

import { Cloud } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import {
  formatPortfolioCloudSyncTime,
  usePortfolioCloudSyncTime,
} from "@/lib/portfolio-cloud-sync-time";

type Props = {
  className?: string;
};

// 포트폴리오 관리 우측 상단 클라우드 동기화 상태.
// 로그인 상태에서는 "최근 클라우드 동기화 시각"(한국시간 YYYY.MM.DD HH:mm)을 보여주고,
// 이력이 없으면 "최근 클라우드 동기화 없음"으로 표시한다.
// 비로그인/미설정 상태는 기존 저장 모드 안내를 유지한다.
export default function PortfolioCloudSyncStatus({ className = "" }: Props) {
  const { user, loading, configured } = useFirebaseAuth();
  const isLight = useResolvedTheme() === "light";
  const lastSyncedAt = usePortfolioCloudSyncTime();

  const pill = (tone: string, content: React.ReactNode) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone} ${className}`}
    >
      {content}
    </span>
  );

  if (!configured) {
    return pill(
      isLight
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-amber-400/20 bg-amber-500/10 text-amber-200",
      "Firebase 미설정 · 로컬 저장",
    );
  }
  if (loading) {
    return pill(
      isLight
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-blue-400/20 bg-blue-500/10 text-blue-200",
      "로그인 확인 중",
    );
  }
  if (!user) {
    return pill(
      isLight
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-slate-500/20 bg-white/5 text-slate-300",
      "로그인 필요 · 로컬 저장",
    );
  }

  const timeText = formatPortfolioCloudSyncTime(lastSyncedAt);
  const tone = isLight
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200";

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 ${tone} ${className}`}
    >
      <Cloud size={15} strokeWidth={2.2} className="shrink-0" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[10.5px] font-medium opacity-80">
          최근 클라우드 동기화{timeText ? "" : " 없음"}
        </span>
        {timeText && (
          <span className="num text-[12.5px] font-bold tabular-nums">{timeText}</span>
        )}
      </div>
    </div>
  );
}
