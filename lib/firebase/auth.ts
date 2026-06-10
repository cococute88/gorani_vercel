"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "./client";
import { ensureUserProfile } from "./firestore-repositories";

export type AuthState = {
  user: User | null;
  loading: boolean;
  error: string | null;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useFirebaseAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        await ensureUserProfile(nextUser).catch((err) => {
          console.warn("Failed to ensure Firebase user profile", err);
        });
      }
    });
  }, []);

  const signInWithGoogle = async () => {
    if (!firebaseAuth) {
      setError("Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다.");
      return;
    }

    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (err) {
      console.warn("Google sign-in failed", err);
      setError("Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  const logout = async () => {
    if (!firebaseAuth) return;
    setError(null);
    try {
      await signOut(firebaseAuth);
    } catch (err) {
      console.warn("Sign-out failed", err);
      setError("로그아웃에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  };

  return { user, loading, error, configured: isFirebaseConfigured, signInWithGoogle, logout };
}
