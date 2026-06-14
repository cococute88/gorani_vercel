"use client";

import { LogIn, LogOut } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";

// Header sign-in control. The "Google 로그인" button is always visible so the
// auth path is never hidden. When Firebase env vars are missing the button is
// shown disabled with a tooltip explaining local-only mode, instead of
// disappearing entirely (which is what regressed previously).
export default function LoginButton() {
  const { user, loading, error, configured, signInWithGoogle, logout } =
    useFirebaseAuth();
  const isLight = useResolvedTheme() === "light";

  const signedIn = Boolean(user);
  const label = signedIn ? "로그아웃" : "Google 로그인";
  const shortLabel = signedIn ? "계정" : "로그인";
  const disabled = loading || (!configured && !signedIn);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {signedIn && (
        <span
          className={`hidden max-w-[140px] truncate text-[12px] lg:inline ${
            isLight ? "text-slate-500" : "text-slate-300"
          }`}
        >
          {user?.displayName || user?.email}
        </span>
      )}
      <button
        type="button"
        onClick={signedIn ? logout : signInWithGoogle}
        disabled={disabled}
        aria-label={label}
        title={configured ? label : "Firebase 미설정 · 로컬 저장 모드 (로그인 불가)"}
        className={`inline-flex h-8 items-center gap-1 rounded-md px-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:text-[13px] ${
          isLight
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {signedIn ? <LogOut size={14} /> : <LogIn size={14} />}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </button>
      {error && (
        <span className="max-w-[180px] truncate text-[11px] text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
