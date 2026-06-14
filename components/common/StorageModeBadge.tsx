"use client";

import { useFirebaseAuth } from "@/lib/firebase/auth";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

type Props = {
  className?: string;
};

export default function StorageModeBadge({ className = "" }: Props) {
  const { user, configured } = useFirebaseAuth();
  const isLight = useResolvedTheme() === "light";
  const label = !configured ? "Firebase 미설정 · 로컬 저장" : user ? "클라우드 동기화" : "비로그인 · 로컬 저장";
  const tone = !configured
    ? isLight
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-amber-400/20 bg-amber-500/10 text-amber-200"
    : user
      ? isLight
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : isLight
        ? "border-slate-200 bg-slate-100 text-slate-600"
        : "border-slate-500/20 bg-white/5 text-slate-300";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone} ${className}`}>{label}</span>;
}
