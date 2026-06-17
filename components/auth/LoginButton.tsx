"use client";

import { LogIn, LogOut } from "lucide-react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { loadUserDisplayProfile, saveUserDisplayProfile, warnFirestoreFallback } from "@/lib/firebase/firestore-repositories";
import { useResolvedTheme } from "@/components/theme/ThemeProvider";
import { useEffect, useState } from "react";

// Header sign-in control. The "Google 로그인" button is always visible so the
// auth path is never hidden. When Firebase env vars are missing the button is
// shown disabled with a tooltip explaining local-only mode, instead of
// disappearing entirely (which is what regressed previously).
export default function LoginButton() {
  const { user, loading, error, configured, signInWithGoogle, logout } =
    useFirebaseAuth();
  const isLight = useResolvedTheme() === "light";

  const [displayName, setDisplayName] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  const fallbackName = user?.displayName || user?.email?.split("@")[0] || user?.email || "";

  useEffect(() => {
    if (!user) return;
    loadUserDisplayProfile(user.uid)
      .then((profile) => {
        const next = profile?.displayName || fallbackName;
        setDisplayName(next);
        setDraftName(next);
      })
      .catch((err) => {
        warnFirestoreFallback("userDisplayProfile.load", err);
        setDisplayName(fallbackName);
        setDraftName(fallbackName);
      });
  }, [fallbackName, user]);

  const saveDisplayName = async () => {
    if (!user) return;
    const next = draftName.trim();
    if (!next) return;
    try {
      await saveUserDisplayProfile(user.uid, next);
      setDisplayName(next);
      setProfileMessage("표시 이름을 저장했습니다.");
    } catch (err) {
      warnFirestoreFallback("userDisplayProfile.save", err);
      setProfileMessage("표시 이름 저장에 실패했습니다.");
    }
  };

  const signedIn = Boolean(user);
  const label = signedIn ? "Logout" : "Google 로그인";
  const shortLabel = signedIn ? "Logout" : "로그인";
  const disabled = loading || (!configured && !signedIn);

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {signedIn && (
        <button
          type="button"
          onClick={() => { setProfileOpen(true); setProfileMessage(""); }}
          className={`hidden max-w-[140px] truncate rounded-md px-2 py-1 text-[12px] lg:inline ${
            isLight ? "text-slate-500 hover:bg-slate-100" : "text-slate-300 hover:bg-white/10"
          }`}
          title="표시 이름 변경"
        >
          {displayName || fallbackName}
        </button>
      )}
      <button
        type="button"
        onClick={signedIn ? logout : signInWithGoogle}
        disabled={disabled}
        aria-label={label}
        title={configured ? label : "Firebase 미설정 · 로컬 저장 모드 (로그인 불가)"}
        className={`inline-flex h-8 min-w-[72px] items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-0 sm:px-3 sm:text-[13px] ${
          isLight
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
            : "bg-white/10 text-white hover:bg-white/20"
        }`}
      >
        {signedIn ? <LogOut size={14} /> : <LogIn size={14} />}
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel}</span>
      </button>
      {profileOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-[#151b1d] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold text-white">표시 이름 변경</h2>
              <button type="button" onClick={() => setProfileOpen(false)} className="rounded px-2 py-1 text-sm font-bold text-slate-300 hover:bg-white/10">닫기</button>
            </div>
            <input value={draftName} onChange={(event) => setDraftName(event.target.value)} placeholder="표시 이름 입력" className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-500" />
            {profileMessage && <p className="mt-2 text-[12px] font-semibold text-blue-200">{profileMessage}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setProfileOpen(false)} className="rounded-xl border border-slate-600 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10">닫기</button>
              <button type="button" onClick={saveDisplayName} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-500">저장</button>
            </div>
          </div>
        </div>
      )}
      {error && (
        <span className="max-w-[180px] truncate text-[11px] text-red-300">
          {error}
        </span>
      )}
    </div>
  );
}
