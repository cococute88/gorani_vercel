"use client";

import { useEffect, useState } from "react";
import { useFirebaseAuth } from "@/lib/firebase/auth";
import {
  getSnapshots,
  mergePortfolioSnapshots,
  replaceSnapshots,
} from "@/lib/portfolio-store";
import {
  loadPortfolioSnapshots,
  savePortfolioSnapshot,
  warnFirestoreFallback,
} from "@/lib/firebase/firestore-repositories";

export type PortfolioCloudSyncStatus = "idle" | "auth-loading" | "local-only" | "syncing" | "synced" | "failed";

export type PortfolioCloudSyncState = {
  status: PortfolioCloudSyncStatus;
  error: string | null;
};

let syncedUid: string | null = null;

export function usePortfolioCloudSync(): PortfolioCloudSyncState {
  const { user, loading, configured } = useFirebaseAuth();
  const [state, setState] = useState<PortfolioCloudSyncState>({
    status: loading ? "auth-loading" : "idle",
    error: null,
  });

  useEffect(() => {
    if (!configured) {
      setState({ status: "local-only", error: null });
      syncedUid = null;
      return;
    }
    if (loading) {
      setState({ status: "auth-loading", error: null });
      return;
    }
    if (!user) {
      setState({ status: "local-only", error: null });
      syncedUid = null;
      return;
    }
    if (syncedUid === user.uid) return;

    let cancelled = false;
    syncedUid = user.uid;
    setState({ status: "syncing", error: null });

    const localBeforeLoad = getSnapshots();
    loadPortfolioSnapshots(user.uid)
      .then(async (cloudSnapshots) => {
        if (cancelled) return;
        const merged = mergePortfolioSnapshots(localBeforeLoad, cloudSnapshots);
        replaceSnapshots(merged);

        const cloudDates = new Set(cloudSnapshots.map((snapshot) => snapshot.snapshotDate));
        const localOnlySnapshots = merged.filter((snapshot) => !cloudDates.has(snapshot.snapshotDate));
        await Promise.all(localOnlySnapshots.map((snapshot) => savePortfolioSnapshot(user.uid, snapshot)));

        if (!cancelled) setState({ status: "synced", error: null });
      })
      .catch((err) => {
        syncedUid = null;
        warnFirestoreFallback("portfolioSnapshots.sync", err);
        if (!cancelled) setState({ status: "failed", error: "동기화 실패 · 로컬 저장 유지" });
      });

    return () => {
      cancelled = true;
    };
  }, [configured, loading, user]);

  return state;
}
