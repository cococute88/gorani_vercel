"use client";

import { useFirebaseAuth } from "@/lib/firebase/auth";

export default function AuthStatus() {
  const { user, configured } = useFirebaseAuth();
  if (!configured) return <span>Firebase 설정 없음 · 로컬 미리보기</span>;
  if (!user) return <span>로그인하지 않음 · 브라우저 저장</span>;
  return <span>{user.email ?? user.displayName} · 계정 저장</span>;
}
