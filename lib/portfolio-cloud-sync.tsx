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
import { USE_FIRESTORE_CONTRACT } from "@/lib/feature-flags";
import { loadPortfolioContract } from "@/lib/firestore-portfolio-adapter";
import { markPortfolioCloudSyncNow } from "@/lib/portfolio-cloud-sync-time";

export type PortfolioCloudSyncStatus =
  | "idle"
  | "auth-loading"
  | "local-only"
  | "syncing"
  | "synced"
  | "contract-empty"
  | "failed";

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

    // Phase C/F: when USE_FIRESTORE_CONTRACT is ON, the Firestore read adapter
    // is the ONLY entry point for portfolio data. Read the contract, map it
    // into snapshots, and replace the store. No raw-snapshot read, no write-back.
    //
    // Phase F — non-destructive loading: NEVER erase existing local snapshots
    // because of an empty/invalid Firestore response. Only replace the store
    // when the contract actually yields at least one valid snapshot ("ok").
    // "empty-collection" (no contract written yet) and "all-skipped" (contract
    // exists but every document is invalid) keep the user's local data intact.
    if (USE_FIRESTORE_CONTRACT) {
      loadPortfolioContract(user.uid)
        .then((adapted) => {
          if (cancelled) return;
          if (adapted.outcome === "ok") {
            replaceSnapshots(adapted.snapshots);
            setState({ status: "synced", error: null });
            return;
          }
          // Do NOT touch the local store. Allow a re-attempt on next mount.
          syncedUid = null;
          if (adapted.outcome === "all-skipped") {
            warnFirestoreFallback(
              "portfolioContract.read",
              new Error(`All ${adapted.documentCount} contract document(s) were invalid: ${adapted.skipped.map((s) => s.reason).join("; ")}`),
            );
          }
          setState({
            status: "contract-empty",
            error: "Firestore 계약 데이터가 비어 있어 기존 로컬 데이터를 유지합니다.",
          });
        })
        .catch((err) => {
          syncedUid = null;
          warnFirestoreFallback("portfolioContract.read", err);
          if (!cancelled) setState({ status: "failed", error: "Firestore 계약 로드 실패 · 로컬 저장 유지" });
        });

      return () => {
        cancelled = true;
      };
    }

    const localBeforeLoad = getSnapshots();
    loadPortfolioSnapshots(user.uid)
      .then(async (cloudSnapshots) => {
        if (cancelled) return;
        const merged = mergePortfolioSnapshots(localBeforeLoad, cloudSnapshots);
        replaceSnapshots(merged);

        const cloudDates = new Set(cloudSnapshots.map((snapshot) => snapshot.snapshotDate));
        const localOnlySnapshots = merged.filter((snapshot) => !cloudDates.has(snapshot.snapshotDate));
        await Promise.all(localOnlySnapshots.map((snapshot) => savePortfolioSnapshot(user.uid, snapshot)));
        // 로컬 전용 스냅샷을 실제로 Firestore 에 올린 경우에만 마지막 동기화 시각을 갱신한다.
        if (localOnlySnapshots.length > 0) markPortfolioCloudSyncNow();

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
