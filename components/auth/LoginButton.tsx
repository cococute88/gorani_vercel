"use client";

import { useFirebaseAuth } from "@/lib/firebase/auth";

export default function LoginButton() {
  const { user, loading, error, configured, signInWithGoogle, logout } = useFirebaseAuth();

  if (!configured) {
    return (
      <span className="hidden rounded-md border border-amber-400/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-amber-200 sm:inline-flex">
        Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다.
      </span>
    );
  }

  return (
    <div className="hidden items-center gap-2 sm:flex">
      {user && (
        <span className="max-w-[140px] truncate text-[12px] text-slate-300">
          {user.displayName || user.email}
        </span>
      )}
      <button
        type="button"
        onClick={user ? logout : signInWithGoogle}
        disabled={loading}
        className="rounded-md bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20 disabled:opacity-50"
      >
        {user ? "로그아웃" : "Google 로그인"}
      </button>
      {error && <span className="max-w-[180px] truncate text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
