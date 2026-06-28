"use client";

import { useMemo } from "react";
import { usePortfolioSnapshots } from "./portfolio-store";
import { usePortfolioFirestoreSnapshotData } from "./portfolio-firestore-snapshot-sync";
import { buildPortfolioPageFromSnapshots } from "./portfolio-from-snapshots";

export function usePortfolioView() {
  // localStorage-backed legacy snapshots (fallback source).
  const localSnapshots = usePortfolioSnapshots();
  // Firestore single source: non-null only when the latest Firestore snapshot
  // resolved successfully (see portfolio-firestore-snapshot-sync).
  const firestoreSnapshot = usePortfolioFirestoreSnapshotData();

  // When Firestore data exists, the Portfolio screen runs entirely on that one
  // snapshot — localStorage is NOT merged in. Only when Firestore is absent
  // (loading / empty / error) do we fall back to the legacy localStorage data.
  const snapshots = useMemo(
    () => (firestoreSnapshot ? [firestoreSnapshot] : localSnapshots),
    [firestoreSnapshot, localSnapshots],
  );

  return useMemo(() => buildPortfolioPageFromSnapshots(snapshots), [snapshots]);
}
