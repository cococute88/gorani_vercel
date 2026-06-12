"use client";

import { CloudOff, LogIn, LogOut } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";

export default function LoginButton() {
  const { user, loading, error, configured, signInWithGoogle, logout } = useFirebaseAuth();

  if (!configured) {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-400/20 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-200 sm:px-2.5">
        <CloudOff size={14} />
        <span className="sm:hidden">로컬</span>
        <span className="hidden sm:inline">Firebase 미설정 · 로컬 저장</span>
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {user && (
        <span className="hidden max-w-[140px] truncate text-[12px] text-slate-300 lg:inline">
          {user.displayName || user.email}
        </span>
      )}
      <button
        type="button"
        onClick={user ? logout : signInWithGoogle}
        disabled={loading}
        aria-label={user ? "로그아웃" : "Google 로그인"}
        title={user ? "로그아웃" : "Google 로그인"}
        className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-2 text-[12px] font-medium text-white hover:bg-white/20 disabled:opacity-50 sm:px-3 sm:text-[13px]"
      >
        {user ? <LogOut size={14} /> : <LogIn size={14} />}
        <span className="hidden sm:inline">{user ? "로그아웃" : "Google 로그인"}</span>
        <span className="sm:hidden">{user ? "계정" : "로그인"}</span>
      </button>
      {error && <span className="max-w-[180px] truncate text-[11px] text-red-300">{error}</span>}
    </div>
  );
}
