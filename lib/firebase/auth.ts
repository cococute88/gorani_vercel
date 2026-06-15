"use client";

import { useEffect, useState } from "react";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
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

let persistenceReady: Promise<void> | null = null;
let redirectResultReady: Promise<void> | null = null;

export function ensureFirebaseLocalPersistence(): Promise<void> {
  if (!firebaseAuth) return Promise.resolve();
  if (!persistenceReady) {
    persistenceReady = setPersistence(firebaseAuth, browserLocalPersistence).catch((err) => {
      persistenceReady = null;
      throw err;
    });
  }
  return persistenceReady;
}

function isMobileBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isPopupBlockedError(err: unknown): boolean {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: unknown }).code) : "";
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(code);
}

export function handleGoogleRedirectResult(): Promise<void> {
  if (!firebaseAuth) return Promise.resolve();
  const auth = firebaseAuth;
  if (!redirectResultReady) {
    redirectResultReady = ensureFirebaseLocalPersistence()
      .then(() => getRedirectResult(auth))
      .then(async (credential) => {
        if (credential?.user) await ensureUserProfile(credential.user);
      })
      .catch((err) => {
        console.warn("Google redirect result handling failed", err);
      });
  }
  return redirectResultReady;
}

export function useFirebaseAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return undefined;
    }

    let active = true;
    ensureFirebaseLocalPersistence()
      .then(() => handleGoogleRedirectResult())
      .catch((err) => {
        console.warn("Failed to prepare Firebase Auth persistence", err);
        if (active) setError("로그인 유지 설정을 준비하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.");
      });

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (nextUser) => {
      setUser(nextUser);
      setLoading(false);
      if (nextUser) {
        await ensureUserProfile(nextUser).catch((err) => {
          console.warn("Failed to ensure Firebase user profile", err);
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!firebaseAuth) {
      setError("Firebase 설정이 없어 로컬 미리보기 모드로 동작합니다.");
      return;
    }

    setError(null);
    try {
      await ensureFirebaseLocalPersistence();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      if (isMobileBrowser()) {
        await signInWithRedirect(firebaseAuth, provider);
        return;
      }
      await signInWithPopup(firebaseAuth, provider);
    } catch (err) {
      if (isPopupBlockedError(err)) {
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await ensureFirebaseLocalPersistence();
          await signInWithRedirect(firebaseAuth, provider);
          return;
        } catch (redirectErr) {
          console.warn("Google redirect fallback failed", redirectErr);
        }
      }
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
