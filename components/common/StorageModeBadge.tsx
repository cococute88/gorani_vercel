"use client";

import { useFirebaseAuth } from "@/lib/firebase/auth";

type Props = {
  className?: string;
};

export default function StorageModeBadge({ className = "" }: Props) {
  const { user, configured } = useFirebaseAuth();
  const label = !configured ? "로컬 미리보기 저장" : user ? "계정 저장" : "이 브라우저에만 임시 저장";
  const tone = !configured
    ? "border-amber-400/20 bg-amber-500/10 text-amber-200"
    : user
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
      : "border-slate-500/20 bg-white/5 text-slate-300";

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone} ${className}`}>{label}</span>;
}
