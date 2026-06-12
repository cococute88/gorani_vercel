"use client";

import { useFirebaseAuth } from "@/lib/firebase/auth";

export default function AuthStatus() {
  const { user, configured } = useFirebaseAuth();
  if (!configured) return <span>Firebase 미설정 · 로컬 저장</span>;
  if (!user) return <span>비로그인 · 로컬 저장</span>;
  return <span>{user.email ?? user.displayName} · 클라우드 동기화</span>;
}
