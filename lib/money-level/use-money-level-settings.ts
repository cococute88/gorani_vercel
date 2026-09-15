"use client";
import { useEffect, useRef, useState } from "react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import { createSettingsCloud } from "./settings-cloud";
import { MoneyLevelSettingsSession, type SettingsState } from "./settings-persistence";
import { normalizeMoneyLevelSettings } from "./settings";
import type { MoneyLevelSettings } from "./types";

export function useMoneyLevelSettings() {
  const { user, loading } = useFirebaseAuth();
  const scope = user?.uid ?? "guest";
  const session = useRef<MoneyLevelSettingsSession | null>(null);
  const [state, setState] = useState<SettingsState & { scope: string | null }>({ status: "uninitialized", settings: normalizeMoneyLevelSettings(null), source: "local", error: null, scope: null });
  useEffect(() => {
    if (loading) return;
    const active = new MoneyLevelSettingsSession(user?.uid ?? null, {
      getItem: key => window.localStorage.getItem(key), setItem: (key,value) => window.localStorage.setItem(key,value),
    }, user ? createSettingsCloud(user.uid) : null, next => setState({ ...next, scope }));
    session.current = active;
    void active.hydrate();
    const reconnect = () => { if (active.state.status === "ready") void active.hydrate(); };
    window.addEventListener("online", reconnect);
    return () => { active.dispose(); session.current = null; window.removeEventListener("online", reconnect); };
  }, [loading, scope, user]);
  const ready = !loading && state.scope === scope && state.status === "ready";
  return { ...state, status: ready ? "ready" as const : "loading" as const,
    save: (settings: MoneyLevelSettings) => ready && session.current ? session.current.save(settings) : Promise.reject(new Error("Settings are loading")) };
}
